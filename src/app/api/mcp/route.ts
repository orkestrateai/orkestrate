import { createHash, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { getClientRegistration, validateAccessToken } from "@/lib/oauth-store";
import { ensureActiveWorkspaceForUser } from "@/lib/workspaces-core";
import { buildScopedClientId, resolveCanonicalAgentIdentity } from "@/lib/agent-identity";
import { getToolAdapter } from "@/tools/_base";
import { getJoinedWorkspaceForAgent, joinWorkspaceForAgent, touchAgentSession } from "@/lib/agents-core";
import { db } from "@/db";
import { agentSessions, agentStates, knowledgeDocs } from "@/db/schema";
import { and, asc, eq, ilike, isNull, or } from "drizzle-orm";

type RpcId = string | number | null;

type AgentStateContent = {
  agentProfile: string;
  currentObjective: string;
  architectureFootprint: string[];
  implementationPlan: string[];
  notesForTeam: string;
  pastWorkSummary: string[];
};

type StoredAgentState = {
  scopedAgentId: string;
  agentId: string;
  status: "active" | "idle" | "blocked";
  content: AgentStateContent;
  objective: string;
  claimedPaths: string[];
  plan: string[];
  notes: string;
  completed: string[];
  repo: {
    canonicalRemote: string | null;
    branch: string | null;
    headSha: string | null;
    dirty: boolean | null;
    aheadBehind: string | null;
  };
  updatedAt: string;
};

type StoredKnowledgeDoc = {
  id: string;
  roomId: string;
  title: string;
  description: string;
  content: string;
  parentId: string | null;
  isFolder: boolean;
  createdAt: string;
  updatedAt: string;
};

type RoomBucket = {
  agentMetadata: Map<string, { agentProfile: string; pastWorkSummary: string[] }>;
};

const READ_KNOWLEDGE_BASE_ENABLED = false;

declare global {
  var __orkestrateRuntimeStore: Map<string, RoomBucket> | undefined;
}

function getRuntimeStore() {
  if (!global.__orkestrateRuntimeStore) {
    global.__orkestrateRuntimeStore = new Map<string, RoomBucket>();
  }
  return global.__orkestrateRuntimeStore;
}

function getRoomBucket(roomId: string): RoomBucket {
  const store = getRuntimeStore();
  const existing = store.get(roomId);
  if (existing) return existing;

  const bucket: RoomBucket = {
    agentMetadata: new Map<string, { agentProfile: string; pastWorkSummary: string[] }>(),
  };
  store.set(roomId, bucket);
  return bucket;
}

function rpcResult(id: RpcId, result: unknown) {
  return { jsonrpc: "2.0", id, result };
}

function rpcError(id: RpcId, code: number, message: string) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

function baseUrl(req: NextRequest) {
  const proto = String(req.headers.get("x-forwarded-proto") || req.nextUrl.protocol.replace(":", "") || "https")
    .split(",")[0].trim();
  const host = String(req.headers.get("x-forwarded-host") || req.headers.get("host") || req.nextUrl.host || "")
    .split(",")[0].trim();
  return `${proto}://${host}`;
}

function bearerToken(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (typeof auth !== "string" || !auth.startsWith("Bearer ")) return null;
  const token = auth.slice("Bearer ".length).trim();
  return token || null;
}

function json(
  payloadOrStatus: unknown,
  statusOrPayload: unknown = 200,
  extraHeaders: Record<string, string> = {},
) {
  const status = typeof payloadOrStatus === "number"
    ? payloadOrStatus
    : (typeof statusOrPayload === "number" ? statusOrPayload : 200);
  const payload = typeof payloadOrStatus === "number"
    ? statusOrPayload
    : payloadOrStatus;

  return NextResponse.json(payload, {
    status,
    headers: {
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
  });
}

function sendOAuthChallenge(req: NextRequest, description = "Valid OAuth bearer token required.") {
  const base = baseUrl(req);
  const resourceMeta = `${base}/.well-known/oauth-protected-resource/api/mcp`;
  const challenge = `Bearer realm="agentalk", error="invalid_token", error_description="${description}", resource_metadata="${resourceMeta}"`;
  return json({ error: "unauthorized", error_description: description }, 401, {
    "WWW-Authenticate": challenge,
  });
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => Boolean(item));
}

function firstNonEmptyString(obj: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function firstStringList(obj: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const list = normalizeStringList(obj[key]);
    if (list.length > 0) return list;
  }
  return [];
}

function inferStateStatus(
  raw: string | null,
  currentObjective: string,
  architectureFootprint: string[],
  implementationPlan: string[],
): StoredAgentState["status"] {
  const normalized = String(raw || "").trim().toLowerCase();
  if (normalized === "blocked") return "blocked";
  if (normalized === "idle") return "idle";
  if (normalized === "active") return "active";

  const looksIdle =
    architectureFootprint.length === 0 &&
    implementationPlan.length === 0 &&
    /(standing by|idle|waiting)/i.test(currentObjective);
  return looksIdle ? "idle" : "active";
}

function coerceRepo(value: unknown): StoredAgentState["repo"] {
  const obj = value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

  const canonicalRemote = typeof obj.canonicalRemote === "string" && obj.canonicalRemote.trim()
    ? obj.canonicalRemote.trim()
    : null;
  const branch = typeof obj.branch === "string" && obj.branch.trim() ? obj.branch.trim() : null;
  const headSha = typeof obj.headSha === "string" && obj.headSha.trim() ? obj.headSha.trim() : null;
  const dirty = typeof obj.dirty === "boolean" ? obj.dirty : null;
  const aheadBehind = typeof obj.aheadBehind === "string" && obj.aheadBehind.trim() ? obj.aheadBehind.trim() : null;

  return { canonicalRemote, branch, headSha, dirty, aheadBehind };
}

function coerceState(
  scopedAgentId: string,
  canonicalAgentId: string,
  content: unknown,
): StoredAgentState {
  const obj = content && typeof content === "object" && !Array.isArray(content)
    ? (content as Record<string, unknown>)
    : {};

  const currentObjective = firstNonEmptyString(obj, ["currentObjective", "objective"]) || "Standing by for next task.";
  const architectureFootprint = firstStringList(obj, ["architectureFootprint", "claimedPaths"]);
  const implementationPlan = firstStringList(obj, ["implementationPlan", "plan"]);
  const notesForTeam = firstNonEmptyString(obj, ["notesForTeam", "notes"]) || "";
  const pastWorkSummary = firstStringList(obj, ["pastWorkSummary", "completed"]);
  const agentProfile = firstNonEmptyString(obj, ["agentProfile"]) || `${canonicalAgentId} - coordination agent`;

  const status = inferStateStatus(
    firstNonEmptyString(obj, ["status"]),
    currentObjective,
    architectureFootprint,
    implementationPlan,
  );

  const contentState: AgentStateContent = {
    agentProfile,
    currentObjective,
    architectureFootprint,
    implementationPlan,
    notesForTeam,
    pastWorkSummary,
  };

  return {
    scopedAgentId,
    agentId: canonicalAgentId,
    status,
    content: contentState,
    objective: contentState.currentObjective,
    claimedPaths: contentState.architectureFootprint,
    plan: contentState.implementationPlan,
    notes: contentState.notesForTeam,
    completed: contentState.pastWorkSummary,
    repo: coerceRepo(obj.repo),
    updatedAt: new Date().toISOString(),
  };
}

function mapKnowledgeDocRow(row: typeof knowledgeDocs.$inferSelect): StoredKnowledgeDoc {
  return {
    id: row.id,
    roomId: row.roomId,
    title: row.title,
    description: row.description,
    content: row.content,
    parentId: row.parentId,
    isFolder: row.isFolder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function getKnowledgeDocById(roomId: string, id: string) {
  return db.query.knowledgeDocs.findFirst({
    where: and(eq(knowledgeDocs.roomId, roomId), eq(knowledgeDocs.id, id)),
  });
}

async function collectKnowledgeDescendants(roomId: string, rootId: string) {
  const descendants: string[] = [];
  const queue = [rootId];
  while (queue.length > 0) {
    const parentId = queue.shift()!;
    const children = await db
      .select({ id: knowledgeDocs.id })
      .from(knowledgeDocs)
      .where(and(eq(knowledgeDocs.roomId, roomId), eq(knowledgeDocs.parentId, parentId)));
    for (const child of children) {
      descendants.push(child.id);
      queue.push(child.id);
    }
  }
  return descendants;
}

async function validateKnowledgeParent(
  roomId: string,
  parentId: string | null,
  movingDocId?: string,
) {
  if (parentId === null) return { ok: true as const };
  const parent = await getKnowledgeDocById(roomId, parentId);
  if (!parent) return { ok: false as const, reason: "Parent doc not found." };
  if (!parent.isFolder) return { ok: false as const, reason: "Parent must be a folder." };
  if (movingDocId && parent.id === movingDocId) {
    return { ok: false as const, reason: "A doc cannot be its own parent." };
  }
  if (movingDocId) {
    const descendants = new Set(await collectKnowledgeDescendants(roomId, movingDocId));
    if (descendants.has(parent.id)) {
      return { ok: false as const, reason: "Move would create a parent cycle." };
    }
  }
  return { ok: true as const };
}

function nextVersionFrom(current: string | null | undefined) {
  const match = String(current || "").match(/^v(\d+)$/);
  const n = match ? Number(match[1]) : 0;
  return `v${Number.isFinite(n) ? n + 1 : 1}`;
}

function stripUrlToHost(urlOrHost: string): string {
  const raw = String(urlOrHost || "").trim();
  if (!raw) return "orkestrate.vercel.app";

  try {
    return new URL(raw).host;
  } catch {
    return raw.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  }
}

async function listWorkspaceCoordinationStates(workspaceId: string): Promise<StoredAgentState[]> {
  const sessions = await db.query.agentSessions.findMany({
    where: and(eq(agentSessions.roomId, workspaceId), eq(agentSessions.status, "active")),
  });

  const bucket = getRoomBucket(workspaceId);
  const rows: StoredAgentState[] = [];
  for (const session of sessions) {
    const state = await db.query.agentStates.findFirst({
      where: eq(agentStates.sessionId, session.id),
    });
    if (!state) continue;

    const agentId = session.agentId.split("::")[1] || session.agentId;
    const metadata = bucket.agentMetadata.get(session.agentId);
    const content: AgentStateContent = {
      agentProfile: metadata?.agentProfile || `${agentId} - coordination agent`,
      currentObjective: state.objective || "Standing by for next task.",
      architectureFootprint: Array.isArray(state.claimedPaths) ? state.claimedPaths : [],
      implementationPlan: Array.isArray(state.plan) ? state.plan : [],
      notesForTeam: state.notes || "",
      pastWorkSummary: metadata?.pastWorkSummary || (Array.isArray(state.completed) ? state.completed : []),
    };

    rows.push({
      scopedAgentId: session.agentId,
      agentId,
      status: state.status === "blocked" ? "blocked" : state.status === "idle" ? "idle" : "active",
      content,
      objective: content.currentObjective,
      claimedPaths: content.architectureFootprint,
      plan: content.implementationPlan,
      notes: content.notesForTeam,
      completed: content.pastWorkSummary,
      repo: {
        canonicalRemote: state.gitRemote,
        branch: state.gitBranch,
        headSha: state.gitHeadSha,
        dirty: state.gitUncommittedChanges,
        aheadBehind: state.gitAheadBehind,
      },
      updatedAt: state.updatedAt.toISOString(),
    });
  }

  return rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

async function workspaceStateHash(workspaceId: string) {
  const sessions = await db.query.agentSessions.findMany({
    where: and(eq(agentSessions.roomId, workspaceId), eq(agentSessions.status, "active")),
  });

  const signatures: string[] = [];
  for (const session of sessions) {
    const state = await db.query.agentStates.findFirst({
      where: eq(agentStates.sessionId, session.id),
    });
    signatures.push([
      session.id,
      state?.version || "v0",
      state?.updatedAt?.toISOString() || "",
    ].join(":"));
  }

  const digest = createHash("sha1").update(signatures.sort().join("|")).digest("hex").slice(0, 12);
  return `v${digest}`;
}

function buildJoinWorkspaceOrchestrationGuide(roomId: string, canonicalAgentId: string) {
  return [
    "Orkestrate coordination instructions:",
    `- roomId: ${roomId}`,
    `- canonicalAgentId: ${canonicalAgentId}`,
    "",
    "Coordination loop (run in this order):",
    "1) read_team_state and capture stateHash.",
    "2) update_my_state with expectedStateHash=stateHash and your current objective/plan/footprint.",
    "3) Execute your next chunk of work.",
    "4) Whenever you make progress, run update_my_state again with the latest expectedStateHash.",
    "5) If update_my_state returns a hash mismatch, immediately run read_team_state, re-evaluate teammate footprints, and retry with the new stateHash.",
    "6) Repeat steps 3-5 until objective complete.",
    "7) Finalize with update_my_state using objective='Standing by for next task.' and empty architectureFootprint + implementationPlan.",
    "",
    "Behavior rules:",
    "- Treat architectureFootprint as a lock: avoid files/modules already claimed by active teammates.",
    "- Keep implementationPlan concrete and short; update it as soon as priorities change.",
    "- Use notesForTeam for handoffs, risks, and irreversible decisions.",
    "- If you intentionally run parallel slots, use the same agentId slot in both read_team_state and update_my_state.",
  ].join("\n");
}

function buildMcpToolList() {
  return [
    // {
    //   name: "Orkestrate_initialize",
    //   description: "Bootstrap plugin/session wiring only. Returns canonical agent identity + setup instructions. Call once at session start, then call join_workspace to begin orchestration.",
    //   inputSchema: {
    //     type: "object",
    //     properties: {
    //       agentId: {
    //         type: "string",
    //         description: "Optional agent slot hint (e.g. a, b, main). Use the same slot consistently in this session.",
    //       },
    //     },
    //     additionalProperties: false,
    //   },
    // },
    {
      name: "join_workspace",
      description: "Join the active workspace (or provided workspaceId). REQUIRED before all coordination tools. Returns the orchestration loop + behavior instructions for multi-agent collaboration. Call again after reconnect/new session.",
      inputSchema: {
        type: "object",
        properties: {
          agentId: {
            type: "string",
            description: "Optional agent slot hint. Must match the slot used in read_team_state/update_my_state.",
          },
          workspaceId: {
            type: "string",
            description: "Optional workspace id. Defaults to current active workspace for the authenticated user.",
          },
        },
        additionalProperties: false,
      },
    },
    {
      name: "read_team_state",
      description: "Read all active agents' coordination state in the joined room. ALWAYS call before update_my_state. Returns stateHash; pass it as expectedStateHash to prevent stale writes.",
      inputSchema: {
        type: "object",
        properties: {
          agentId: {
            type: "string",
            description: "Optional slot hint only if running multiple identities from one client. Keep stable per identity.",
          },
        },
        additionalProperties: false,
      },
    },
    {
      name: "update_my_state",
      description: "Publish your current coordination intent (objective, footprint, plan, notes). MUST include expectedStateHash from latest read_team_state. On mismatch, read_team_state and retry.",
      inputSchema: {
        type: "object",
        properties: {
          agentId: {
            type: "string",
            description: "Optional slot hint; must match read_team_state if used.",
          },
          expectedStateHash: {
            type: "string",
            description: "Required hash returned by read_team_state for optimistic concurrency.",
          },
          content: {
            type: "object",
            properties: {
              agentProfile: {
                type: "string",
                description: "Who you are and your focus in one sentence.",
              },
              currentObjective: {
                type: "string",
                description: "The exact thing you are currently doing.",
              },
              architectureFootprint: {
                type: "array",
                items: { type: "string" },
                description: "Paths/modules you currently plan to touch.",
              },
              implementationPlan: {
                type: "array",
                items: { type: "string" },
                description: "Concrete upcoming steps. Keep this current.",
              },
              notesForTeam: {
                type: "string",
                description: "Cross-agent coordination notes, warnings, decisions, handoff context.",
              },
              pastWorkSummary: {
                type: "array",
                items: { type: "string" },
                description: "High-level completed work items.",
              },
              status: {
                type: "string",
                enum: ["active", "idle", "blocked"],
                description: "Optional explicit status override.",
              },
            },
            required: ["agentProfile", "currentObjective", "architectureFootprint", "implementationPlan", "notesForTeam", "pastWorkSummary"],
            additionalProperties: true,
          },
        },
        required: ["content", "expectedStateHash"],
        additionalProperties: false,
      },
    },
    // {
    //   name: "read_knowledge_base",
    //   description: "Read room-scoped knowledge docs stored in Postgres. Use id for direct read, parentId for folder traversal (parentId:null = root), or query for search.",
    //   inputSchema: {
    //     type: "object",
    //     properties: {
    //       id: { type: "string", description: "Optional doc id for direct read." },
    //       parentId: { type: ["string", "null"], description: "Optional parent filter. Use null to list root docs." },
    //       query: { type: "string", description: "Optional case-insensitive search across title/description/content." },
    //       includeContent: { type: "boolean", description: "Include full content in list responses." },
    //     },
    //     additionalProperties: false,
    //   },
    // },
    // {
    //   name: "write_knowledge_base",
    //   description: "Mutate room-scoped knowledge docs in Postgres. Supports create/update/move/delete. Parent must be a folder; move cycles are rejected; folder delete cascades descendants.",
    //   inputSchema: {
    //     type: "object",
    //     properties: {
    //       action: { type: "string", enum: ["create", "update", "move", "delete"] },
    //       id: { type: "string", description: "Required for update/move/delete." },
    //       title: { type: "string", description: "Doc title (create/update)." },
    //       description: { type: "string", description: "Optional doc summary (create/update)." },
    //       content: { type: "string", description: "Doc body (create/update)." },
    //       parentId: { type: ["string", "null"], description: "Folder parent id or null for root." },
    //       isFolder: { type: "boolean", description: "Create as folder when true." },
    //     },
    //     required: ["action"],
    //     additionalProperties: false,
    //   },
    // },
    // Backward-compatible aliases kept visible for older agents:
    // { name: "read_agent_state", description: "Legacy alias for read_team_state. Prefer read_team_state.", inputSchema: { type: "object", properties: { agentId: { type: "string" } }, additionalProperties: false } },
    // { name: "write_agent_state", description: "Legacy alias for update_my_state. Prefer update_my_state.", inputSchema: { type: "object", properties: { agentId: { type: "string" }, content: { type: "object" }, expectedStateHash: { type: "string" } }, required: ["content", "expectedStateHash"], additionalProperties: false } },
  ];
}

export async function POST(req: NextRequest) {
  try {
    if (req.method !== "POST") {
      return json(405, { error: "Method Not Allowed" });
    }

    const oauthClient = createServiceClient();
    const token = bearerToken(req);
    const tokenRecord = await validateAccessToken(oauthClient, token || "");
    if (!tokenRecord) return sendOAuthChallenge(req);

    const rpc = await req.json().catch(() => null);
    if (!rpc || rpc.jsonrpc !== "2.0" || typeof rpc.method !== "string") {
      return json(400, rpcError(rpc?.id ?? null, -32600, "Invalid JSON-RPC request."));
    }

    const id: RpcId = rpc.id ?? null;
    const method = rpc.method;
    const params = rpc.params || {};

    const userId = String(tokenRecord.user_id || "");
    const clientId = String(tokenRecord.client_id || "");
    const clientRegistration = await getClientRegistration(oauthClient, clientId);
    const clientName = clientRegistration?.client_name || null;

    const resolveAgentIdentity = (requestedAgentId: unknown) =>
      resolveCanonicalAgentIdentity({ requestedAgentId, clientId, clientName });

    if (method === "initialize") {
      return json(200, rpcResult(id, {
        protocolVersion: "2025-06-18",
        capabilities: { tools: {}, resources: {} },
        serverInfo: { name: "Orkestrate-mcp-vercel", version: "2.0.0-workspace-join" },
      }));
    }

    if (method === "notifications/initialized") {
      return new NextResponse(null, { status: 204 });
    }

    if (method === "tools/list") {
      return json(200, rpcResult(id, { tools: buildMcpToolList() }));
    }

    if (method !== "tools/call") {
      return json(404, rpcError(id, -32601, `Method '${method}' not found.`));
    }

    const rawName = String(params.name || "");
    const args = params.arguments || {};

    const aliasName = rawName === "read_agent_state"
      ? "read_team_state"
      : rawName === "write_agent_state"
        ? "update_my_state"
        : rawName === "orkestrate_initialize"
          ? "Orkestrate_initialize"
          : rawName;

    const aliasNotice = rawName !== aliasName
      ? `Alias mapping: '${rawName}' -> '${aliasName}'.`
      : null;

    if (aliasName === "Orkestrate_initialize") {
      const workspaceId = await ensureActiveWorkspaceForUser(userId);
      const canonicalIdentity = resolveAgentIdentity((args as Record<string, unknown>).agentId);
      const siteBase = process.env.NEXT_PUBLIC_SITE_URL || baseUrl(req);
      const host = stripUrlToHost(siteBase);
      const adapter = getToolAdapter(canonicalIdentity.family);
      const bootstrapStatus =
        canonicalIdentity.family === "opencode" || canonicalIdentity.family === "claude"
          ? "join-only"
          : "plugin-first";

      const prompt = adapter.buildPhase0Prompt({
        agentId: canonicalIdentity.id,
        clientId,
        roomId: workspaceId,
        host,
      });

      return json(200, rpcResult(id, {
        content: [
          ...(aliasNotice ? [{ type: "text", text: aliasNotice }] : []),
          {
            type: "text",
            text: [
              "Orkestrate initialization:",
              `- workspaceId: ${workspaceId}`,
              `- canonicalAgentId: ${canonicalIdentity.id}`,
              `- family: ${canonicalIdentity.family}`,
              "",
              "Next step:",
              "- End this current session and start a new one.",
              "- Then call join_workspace (or join_workspace with workspaceId).",
              "- All coordination tools require a joined workspace session.",
              "",
              prompt,
            ].join("\n"),
          },
          {
            type: "text",
            text: JSON.stringify({
              workspaceId,
              roomId: workspaceId,
              canonicalAgentId: canonicalIdentity.id,
              family: canonicalIdentity.family,
              status: bootstrapStatus,
            }, null, 2),
          },
        ],
      }));
    }

    if (aliasName === "join_workspace") {
      const argsObj = args as Record<string, unknown>;
      const canonicalIdentity = resolveAgentIdentity(argsObj.agentId);
      const scopedAgentId = buildScopedClientId(clientId, canonicalIdentity.id);
      const workspaceId = typeof argsObj.workspaceId === "string" ? argsObj.workspaceId : undefined;

      // Extract git context from agent
      const gitContext = argsObj.gitContext && typeof argsObj.gitContext === "object" && !Array.isArray(argsObj.gitContext)
        ? argsObj.gitContext as Record<string, unknown>
        : null;
      const gitRemote = gitContext && typeof gitContext.remote === "string" ? gitContext.remote : null;
      const gitBranch = gitContext && typeof gitContext.branch === "string" ? gitContext.branch : null;

      const joined = await joinWorkspaceForAgent({
        userId,
        scopedAgentId,
        client: canonicalIdentity.family,
        label: canonicalIdentity.id,
        workspaceId,
        gitRemote,
        gitBranch,
      });

      if (!joined.ok) {
        const errorDetails = 'details' in joined && joined.details
          ? `\n\nDetails:\n- Agent repo: ${joined.details.agentRepo || 'none'}\n- Room repo: ${joined.details.roomRepo || 'none'}`
          : '';
        return json(200, rpcResult(id, {
          content: [{ type: "text", text: `ERROR: ${joined.reason}${errorDetails}` }],
        }));
      }
      const orchestrationGuide = buildJoinWorkspaceOrchestrationGuide(joined.roomId, canonicalIdentity.id);

      return json(200, rpcResult(id, {
        content: [
          ...(aliasNotice ? [{ type: "text", text: aliasNotice }] : []),
          { type: "text", text: `Joined workspace ${joined.roomId} as ${canonicalIdentity.id}.` },
          { type: "text", text: orchestrationGuide },
          {
            type: "text", text: JSON.stringify({
              workspaceId: joined.roomId,
              roomId: joined.roomId,
              sessionId: joined.sessionId,
              canonicalAgentId: canonicalIdentity.id,
              scopedAgentId,
            }, null, 2)
          },
        ],
      }));
    }

    const resolveJoinedContext = async (argsObj: Record<string, unknown>) => {
      const canonicalIdentity = resolveAgentIdentity(argsObj.agentId);
      const scopedAgentId = buildScopedClientId(clientId, canonicalIdentity.id);
      const joined = await getJoinedWorkspaceForAgent(userId, scopedAgentId);
      return { canonicalIdentity, scopedAgentId, joined };
    };

    if (aliasName === "read_team_state") {
      const argsObj = args as Record<string, unknown>;
      const { canonicalIdentity, scopedAgentId, joined } = await resolveJoinedContext(argsObj);
      if (!joined) {
        return json(200, rpcResult(id, {
          content: [{ type: "text", text: "ERROR: Agent not joined. Call join_workspace first." }],
        }));
      }

      const roomId = joined.roomId;
      await touchAgentSession(scopedAgentId, joined.sessionId);
      const agents = await listWorkspaceCoordinationStates(roomId);
      const stateHash = await workspaceStateHash(roomId);

      const summary = agents.length > 0
        ? agents
          .map((state) => `- ${state.agentId} (${state.status}) objective: ${state.content.currentObjective} | footprint: ${state.content.architectureFootprint.length} paths`)
          .join("\n")
        : "[No agents have published state yet.]";

      return json(200, rpcResult(id, {
        content: [
          ...(aliasNotice ? [{ type: "text", text: aliasNotice }] : []),
          { type: "text", text: summary },
          { type: "text", text: `stateHash=${stateHash}` },
          {
            type: "text",
            text: JSON.stringify({
              workspaceId: roomId,
              roomId,
              canonicalAgentId: canonicalIdentity.id,
              scopedAgentId,
              stateHash,
              agents,
            }, null, 2),
          },
        ],
      }));
    }

    if (aliasName === "update_my_state") {
      const argsObj = args as Record<string, unknown>;
      if (typeof argsObj.content !== "object" || argsObj.content === null || Array.isArray(argsObj.content)) {
        return json(400, rpcError(id, -32602, "Requires object argument 'content'."));
      }
      if (typeof argsObj.expectedStateHash !== "string") {
        return json(400, rpcError(id, -32602, "Requires string argument 'expectedStateHash'."));
      }

      const { canonicalIdentity, scopedAgentId, joined } = await resolveJoinedContext(argsObj);
      if (!joined) {
        return json(200, rpcResult(id, {
          content: [{ type: "text", text: "ERROR: Agent not joined. Call join_workspace first." }],
        }));
      }

      const roomId = joined.roomId;
      await touchAgentSession(scopedAgentId, joined.sessionId);
      const currentHash = await workspaceStateHash(roomId);

      if (argsObj.expectedStateHash !== currentHash) {
        return json(200, rpcResult(id, {
          content: [
            { type: "text", text: "ERROR: Team state changed. Call read_team_state again and retry." },
            { type: "text", text: `currentStateHash=${currentHash}` },
          ],
        }));
      }

      const next = coerceState(scopedAgentId, canonicalIdentity.id, argsObj.content);
      const bucket = getRoomBucket(roomId);
      bucket.agentMetadata.set(scopedAgentId, {
        agentProfile: next.content.agentProfile,
        pastWorkSummary: next.content.pastWorkSummary,
      });
      const existing = await db.query.agentStates.findFirst({
        where: eq(agentStates.sessionId, joined.sessionId),
      });

      const now = new Date();
      const version = nextVersionFrom(existing?.version);

      if (!existing) {
        await db.insert(agentStates).values({
          id: `state_${randomUUID().replace(/-/g, "").slice(0, 12)}`,
          agentId: scopedAgentId,
          sessionId: joined.sessionId,
          roomId,
          status: next.status,
          objective: next.objective,
          claimedPaths: next.claimedPaths,
          plan: next.plan,
          completed: next.completed,
          notes: next.notes,
          version,
          gitRemote: next.repo.canonicalRemote,
          gitBranch: next.repo.branch,
          gitHeadSha: next.repo.headSha,
          gitUncommittedChanges: next.repo.dirty ?? false,
          gitAheadBehind: (next.repo as any).aheadBehind || null,
          createdAt: now,
          updatedAt: now,
        });
      } else {
        await db
          .update(agentStates)
          .set({
            status: next.status,
            objective: next.objective,
            claimedPaths: next.claimedPaths,
            plan: next.plan,
            completed: next.completed,
            notes: next.notes,
            version,
            gitRemote: next.repo.canonicalRemote,
            gitBranch: next.repo.branch,
            gitHeadSha: next.repo.headSha,
            gitUncommittedChanges: next.repo.dirty ?? false,
            gitAheadBehind: (next.repo as any).aheadBehind || null,
            updatedAt: now,
          })
          .where(eq(agentStates.id, existing.id));
      }

      return json(200, rpcResult(id, {
        content: [
          ...(aliasNotice ? [{ type: "text", text: aliasNotice }] : []),
          { type: "text", text: `Successfully updated state for ${canonicalIdentity.id}.` },
          { type: "text", text: `stateHash=${await workspaceStateHash(roomId)}` },
          { type: "text", text: JSON.stringify({ workspaceId: roomId, roomId, state: next }, null, 2) },
        ],
      }));
    }

    if (aliasName === "read_knowledge_base") {
      if (!READ_KNOWLEDGE_BASE_ENABLED) {
        return json(200, rpcResult(id, {
          content: [{ type: "text", text: "ERROR: read_knowledge_base is temporarily disabled in this phase." }],
        }));
      }

      const argsObj = args as Record<string, unknown>;
      const { scopedAgentId, joined } = await resolveJoinedContext(argsObj);
      if (!joined) {
        return json(200, rpcResult(id, {
          content: [{ type: "text", text: "ERROR: Agent not joined. Call join_workspace first." }],
        }));
      }

      const roomId = joined.roomId;
      await touchAgentSession(scopedAgentId, joined.sessionId);

      const idArg = typeof argsObj.id === "string" ? argsObj.id : null;
      const hasParentFilter = Object.prototype.hasOwnProperty.call(argsObj, "parentId");
      const parentIdArg = typeof argsObj.parentId === "string"
        ? argsObj.parentId.trim()
        : (argsObj.parentId === null ? null : undefined);
      const queryArg = typeof argsObj.query === "string" ? argsObj.query.trim().toLowerCase() : "";
      const includeContent = Boolean(argsObj.includeContent);

      if (idArg) {
        const row = await getKnowledgeDocById(roomId, idArg);
        const doc = row ? mapKnowledgeDocRow(row) : null;
        return json(200, rpcResult(id, {
          content: [{ type: "text", text: JSON.stringify({ workspaceId: roomId, roomId, doc }, null, 2) }],
        }));
      }

      const whereClauses: Array<ReturnType<typeof eq> | ReturnType<typeof isNull> | ReturnType<typeof or>> = [
        eq(knowledgeDocs.roomId, roomId),
      ];

      if (hasParentFilter && parentIdArg !== undefined) {
        if (parentIdArg === null) whereClauses.push(isNull(knowledgeDocs.parentId));
        else whereClauses.push(eq(knowledgeDocs.parentId, parentIdArg));
      }

      if (queryArg) {
        const like = `%${queryArg}%`;
        whereClauses.push(or(
          ilike(knowledgeDocs.title, like),
          ilike(knowledgeDocs.description, like),
          ilike(knowledgeDocs.content, like),
        )!);
      }

      const rows = await db
        .select()
        .from(knowledgeDocs)
        .where(and(...whereClauses))
        .orderBy(asc(knowledgeDocs.title), asc(knowledgeDocs.createdAt));

      const docs = rows
        .map((row) => mapKnowledgeDocRow(row))
        .map((doc) => (includeContent ? doc : { ...doc, content: "" }));

      return json(200, rpcResult(id, {
        content: [{ type: "text", text: JSON.stringify({ workspaceId: roomId, roomId, count: docs.length, docs }, null, 2) }],
      }));
    }

    if (aliasName === "write_knowledge_base") {
      const argsObj = args as Record<string, unknown>;
      const { scopedAgentId, joined } = await resolveJoinedContext(argsObj);
      if (!joined) {
        return json(200, rpcResult(id, {
          content: [{ type: "text", text: "ERROR: Agent not joined. Call join_workspace first." }],
        }));
      }

      const roomId = joined.roomId;
      await touchAgentSession(scopedAgentId, joined.sessionId);
      const action = typeof argsObj.action === "string" ? argsObj.action : "";

      if (action === "create") {
        const now = new Date().toISOString();
        const parentId = typeof argsObj.parentId === "string" ? argsObj.parentId.trim() : null;
        const parentCheck = await validateKnowledgeParent(roomId, parentId);
        if (!parentCheck.ok) return json(400, rpcError(id, -32602, parentCheck.reason));

        const title = typeof argsObj.title === "string" && argsObj.title.trim() ? argsObj.title.trim() : "Untitled";
        const docId = `kb_${randomUUID().replace(/-/g, "").slice(0, 20)}`;
        await db.insert(knowledgeDocs).values({
          id: docId,
          roomId,
          title,
          description: typeof argsObj.description === "string" ? argsObj.description.trim() : "",
          content: typeof argsObj.content === "string" ? argsObj.content : "",
          parentId,
          isFolder: Boolean(argsObj.isFolder),
          createdAt: new Date(now),
          updatedAt: new Date(now),
        });
        const inserted = await getKnowledgeDocById(roomId, docId);
        const doc = inserted ? mapKnowledgeDocRow(inserted) : null;

        return json(200, rpcResult(id, {
          content: [{ type: "text", text: JSON.stringify({ workspaceId: roomId, roomId, doc }, null, 2) }],
        }));
      }

      if (action === "update") {
        const idTrimmed = typeof argsObj.id === "string" ? argsObj.id.trim() : "";
        if (!idTrimmed) {
          return json(400, rpcError(id, -32602, "Missing id for update."));
        }

        const existing = await getKnowledgeDocById(roomId, idTrimmed);
        if (!existing) {
          return json(404, rpcError(id, -32004, "Knowledge doc not found."));
        }

        const nextParent = typeof argsObj.parentId === "string"
          ? argsObj.parentId.trim()
          : (argsObj.parentId === null ? null : existing.parentId);
        const parentCheck = await validateKnowledgeParent(roomId, nextParent, existing.id);
        if (!parentCheck.ok) return json(400, rpcError(id, -32602, parentCheck.reason));

        await db
          .update(knowledgeDocs)
          .set({
            title: typeof argsObj.title === "string" && argsObj.title.trim() ? argsObj.title.trim() : existing.title,
            description: typeof argsObj.description === "string" ? argsObj.description.trim() : existing.description,
            content: typeof argsObj.content === "string" ? argsObj.content : existing.content,
            parentId: nextParent,
            updatedAt: new Date(),
          })
          .where(and(eq(knowledgeDocs.id, existing.id), eq(knowledgeDocs.roomId, roomId)));
        const refreshed = await getKnowledgeDocById(roomId, existing.id);
        const updated = refreshed ? mapKnowledgeDocRow(refreshed) : null;

        return json(200, rpcResult(id, {
          content: [{ type: "text", text: JSON.stringify({ workspaceId: roomId, roomId, doc: updated }, null, 2) }],
        }));
      }

      if (action === "move") {
        const idTrimmed = typeof argsObj.id === "string" ? argsObj.id.trim() : "";
        if (!idTrimmed) {
          return json(400, rpcError(id, -32602, "Missing id for move."));
        }

        const existing = await getKnowledgeDocById(roomId, idTrimmed);
        if (!existing) {
          return json(404, rpcError(id, -32004, "Knowledge doc not found."));
        }

        const nextParent = typeof argsObj.parentId === "string"
          ? argsObj.parentId.trim()
          : null;
        const parentCheck = await validateKnowledgeParent(roomId, nextParent, existing.id);
        if (!parentCheck.ok) return json(400, rpcError(id, -32602, parentCheck.reason));

        await db
          .update(knowledgeDocs)
          .set({
            parentId: nextParent,
            updatedAt: new Date(),
          })
          .where(and(eq(knowledgeDocs.id, existing.id), eq(knowledgeDocs.roomId, roomId)));
        const refreshed = await getKnowledgeDocById(roomId, existing.id);
        const updated = refreshed ? mapKnowledgeDocRow(refreshed) : null;

        return json(200, rpcResult(id, {
          content: [{ type: "text", text: JSON.stringify({ workspaceId: roomId, roomId, doc: updated }, null, 2) }],
        }));
      }

      if (action === "delete") {
        const idTrimmed = typeof argsObj.id === "string" ? argsObj.id.trim() : "";
        if (!idTrimmed) {
          return json(400, rpcError(id, -32602, "Missing id for delete."));
        }

        const existing = await getKnowledgeDocById(roomId, idTrimmed);
        if (!existing) {
          return json(404, rpcError(id, -32004, "Knowledge doc not found."));
        }

        const descendants = await collectKnowledgeDescendants(roomId, existing.id);
        if (descendants.length > 0) {
          await db
            .delete(knowledgeDocs)
            .where(and(eq(knowledgeDocs.roomId, roomId), or(...descendants.map((descId) => eq(knowledgeDocs.id, descId)))!));
        }
        await db
          .delete(knowledgeDocs)
          .where(and(eq(knowledgeDocs.roomId, roomId), eq(knowledgeDocs.id, existing.id)));

        return json(200, rpcResult(id, {
          content: [{ type: "text", text: JSON.stringify({ workspaceId: roomId, roomId, deleted: true, deletedCount: descendants.length + 1, doc: mapKnowledgeDocRow(existing) }, null, 2) }],
        }));
      }

      return json(400, rpcError(id, -32602, "Unsupported action. Allowed: create, update, move, delete."));
    }

    return json(400, rpcError(id, -32602, `Unknown tool '${rawName}'.`));
  } catch (error) {
    return json(500, {
      error: "Internal server error",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}

