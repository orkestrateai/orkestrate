import { createHash, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { getClientRegistration, validateAccessToken } from "@/lib/oauth-store";
import { ensureActiveWorkspaceForUser } from "@/lib/workspaces-core";
import { resolveAgentFingerprint } from "@/lib/agent-identity";
import { getToolAdapter } from "@/tools/_base";
import { getJoinedWorkspaceForAgent, joinWorkspaceForAgent, touchAgentSession } from "@/lib/agents-core";
import { db } from "@/db";
import { agentScopeClaims, agentSessions, agentStates, knowledgeDocs } from "@/db/schema";
import { and, asc, desc, eq, ilike, isNull, lte, or } from "drizzle-orm";
import { normalizeGitUrl } from "@/lib/git-context";
import { getIntentDefinition } from "@/lib/intent-workflows/catalog";
import { enforceWriteToolGuard } from "@/lib/intent-workflows/guards";
import { normalizeIntentChain, resolveIntent } from "@/lib/intent-workflows/resolver";
import { createWorkflowRun, pruneExpiredRuns, setRunPhase, touchRun, workflowRunKey } from "@/lib/intent-workflows/runtime";
import type { IntentId, WorkflowPhase, WorkflowRunContext } from "@/lib/intent-workflows/types";

type RpcId = string | number | null;

type AgentStateContent = {
  agentProfile: string;
  currentObjective: string;
  architectureFootprint: string[];
  implementationPlan: string[];
  notesForTeam: string;
  pastWorkSummary: string[];
  status?: "active" | "idle" | "blocked" | "planning" | "handoff" | "done";
  repo?: {
    canonicalRemote?: string | null;
    branch?: string | null;
    headSha?: string | null;
    dirty?: boolean | null;
    aheadBehind?: string | null;
  };
};

type StoredAgentState = {
  scopedAgentId: string;
  agentId: string;
  toolName: string | null;
  status: "active" | "idle" | "blocked" | "planning" | "handoff" | "done";
  content: AgentStateContent;
  objective: string;
  footprint: string[];
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

type ActiveScopeClaim = {
  claimId: string;
  scopedAgentId: string;
  agentId: string;
  paths: string[];
  leaseExpiresAt: string;
};

const DEFAULT_SCOPE_TTL_SECONDS = 900;
const MAX_SCOPE_TTL_SECONDS = 3600;

function normalizeScopePath(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let value = raw.trim().replace(/\\/g, "/");
  if (!value) return null;
  value = value.replace(/^\.\/+/, "").replace(/^\/+/, "").replace(/\/{2,}/g, "/");
  if (!value) return null;
  return value;
}

function normalizeScopePaths(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const normalized = value
    .map((item) => normalizeScopePath(item))
    .filter((item): item is string => Boolean(item));
  return Array.from(new Set(normalized));
}

function normalizePrefix(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

function scopePathsOverlap(aRaw: string, bRaw: string): boolean {
  const a = normalizeScopePath(aRaw);
  const b = normalizeScopePath(bRaw);
  if (!a || !b) return false;
  if (a === b) return true;

  const aGlob = a.endsWith("/**");
  const bGlob = b.endsWith("/**");
  const aBase = aGlob ? a.slice(0, -3) : a;
  const bBase = bGlob ? b.slice(0, -3) : b;
  const aPrefix = normalizePrefix(aBase);
  const bPrefix = normalizePrefix(bBase);

  if (aGlob && (b === aBase || b.startsWith(aPrefix))) return true;
  if (bGlob && (a === bBase || a.startsWith(bPrefix))) return true;

  if (a.startsWith(bPrefix) || b.startsWith(aPrefix)) return true;
  return false;
}

function findScopeConflicts(candidatePaths: string[], existingPaths: string[]): boolean {
  for (const candidate of candidatePaths) {
    for (const existing of existingPaths) {
      if (scopePathsOverlap(candidate, existing)) return true;
    }
  }
  return false;
}

function claimPathCovers(claimPathRaw: string, targetPathRaw: string): boolean {
  const claimPath = normalizeScopePath(claimPathRaw);
  const targetPath = normalizeScopePath(targetPathRaw);
  if (!claimPath || !targetPath) return false;
  if (claimPath === targetPath) return true;

  const claimGlob = claimPath.endsWith("/**");
  const targetGlob = targetPath.endsWith("/**");
  const claimBase = claimGlob ? claimPath.slice(0, -3) : claimPath;
  const targetBase = targetGlob ? targetPath.slice(0, -3) : targetPath;
  const claimPrefix = normalizePrefix(claimBase);

  if (claimGlob) {
    return targetBase === claimBase || targetBase.startsWith(claimPrefix);
  }

  // Treat exact non-glob claims as file/folder claims.
  return targetBase.startsWith(claimPrefix);
}

function isValidHeadSha(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{7,64}$/i.test(value.trim());
}

type StoredKnowledgeDoc = {
  id: string;
  workspaceId: string;
  title: string;
  description: string;
  content: string;
  parentId: string | null;
  isFolder: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AgentMessage = {
  id: string;
  fromAgentId: string;
  toAgentId: string;
  content: string;
  timestamp: string;
};

type WorkspaceBucket = {
  agentMetadata: Map<string, { agentProfile: string; pastWorkSummary: string[] }>;
  workflowRuns: Map<string, WorkflowRunContext>;
  messages: AgentMessage[];
  readReceipts: Map<string, Set<string>>;
};

const READ_KNOWLEDGE_BASE_ENABLED = true;

declare global {
  var __orkestrateRuntimeStore: Map<string, WorkspaceBucket> | undefined;
}

function getRuntimeStore() {
  if (!global.__orkestrateRuntimeStore) {
    global.__orkestrateRuntimeStore = new Map<string, WorkspaceBucket>();
  }
  return global.__orkestrateRuntimeStore;
}

function getWorkspaceBucket(workspaceId: string): WorkspaceBucket {
  const store = getRuntimeStore();
  const existing = store.get(workspaceId);
  if (existing) return existing;

  const bucket: WorkspaceBucket = {
    agentMetadata: new Map<string, { agentProfile: string; pastWorkSummary: string[] }>(),
    workflowRuns: new Map<string, WorkflowRunContext>(),
    messages: [],
    readReceipts: new Map<string, Set<string>>(),
  };
  store.set(workspaceId, bucket);
  return bucket;
}

function getSessionWorkflowRun(
  bucket: WorkspaceBucket,
  scopedAgentId: string,
  sessionId: string,
): WorkflowRunContext | null {
  pruneExpiredRuns(bucket.workflowRuns);
  return bucket.workflowRuns.get(workflowRunKey(scopedAgentId, sessionId)) || null;
}

function setSessionWorkflowRun(
  bucket: WorkspaceBucket,
  run: WorkflowRunContext,
) {
  bucket.workflowRuns.set(workflowRunKey(run.scopedAgentId, run.sessionId), run);
}

function workflowLine(phase: WorkflowPhase | "none", nextRequiredTool: string, why: string) {
  return `Workflow phase=${phase}. Next required tool: ${nextRequiredTool}. Reason: ${why}`;
}

function workflowInstructionPayload(input: {
  ok: boolean;
  intentId?: IntentId | null;
  phase: WorkflowPhase | "none";
  nextRequiredTool: string;
  why: string;
  recommendedArgs?: Record<string, unknown>;
  recoverySteps?: string[];
  errorCode?: string;
  allowedToolsNow?: string[];
}) {
  const payload: Record<string, unknown> = {
    ok: input.ok,
    intentId: input.intentId || null,
    phase: input.phase,
    workflowPhase: input.phase,
    nextRequiredTool: input.nextRequiredTool,
    why: input.why,
    recommendedArgs: input.recommendedArgs || {},
  };

  if (!input.ok) {
    payload.errorCode = input.errorCode || "WORKFLOW_ERROR";
    payload.recoverySteps = input.recoverySteps || [];
    payload.recovery = input.recoverySteps || [];
    payload.allowedToolsNow = input.allowedToolsNow || [];
  }

  return payload;
}

function workflowContentEntries(input: {
  ok: boolean;
  intentId?: IntentId | null;
  phase: WorkflowPhase | "none";
  nextRequiredTool: string;
  why: string;
  recommendedArgs?: Record<string, unknown>;
  recoverySteps?: string[];
  errorCode?: string;
  allowedToolsNow?: string[];
}) {
  return [
    { type: "text" as const, text: workflowLine(input.phase, input.nextRequiredTool, input.why) },
    { type: "text" as const, text: JSON.stringify(workflowInstructionPayload(input), null, 2) },
  ];
}

function hasNonEmptyArchitectureFootprint(content: unknown): boolean {
  const obj = content && typeof content === "object" && !Array.isArray(content)
    ? content as Record<string, unknown>
    : {};
  return firstStringList(obj, ["architectureFootprint", "footprint"]).length > 0;
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
  const challenge = `Bearer realm="orkestrate", error="invalid_token", error_description="${description}", resource_metadata="${resourceMeta}"`;
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
  if (normalized === "planning") return "planning";
  if (normalized === "handoff") return "handoff";
  if (normalized === "done") return "done";
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
  const architectureFootprint = firstStringList(obj, ["architectureFootprint", "footprint"]);
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
    toolName: null,
    status,
    content: contentState,
    objective: contentState.currentObjective,
    footprint: contentState.architectureFootprint,
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
    workspaceId: row.workspaceId,
    title: row.title,
    description: row.description,
    content: row.content,
    parentId: row.parentId,
    isFolder: row.isFolder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function getKnowledgeDocById(workspaceId: string, id: string) {
  return db.query.knowledgeDocs.findFirst({
    where: and(eq(knowledgeDocs.workspaceId, workspaceId), eq(knowledgeDocs.id, id)),
  });
}

async function collectKnowledgeDescendants(workspaceId: string, rootId: string) {
  const descendants: string[] = [];
  const queue = [rootId];
  while (queue.length > 0) {
    const parentId = queue.shift()!;
    const children = await db
      .select({ id: knowledgeDocs.id })
      .from(knowledgeDocs)
      .where(and(eq(knowledgeDocs.workspaceId, workspaceId), eq(knowledgeDocs.parentId, parentId)));
    for (const child of children) {
      descendants.push(child.id);
      queue.push(child.id);
    }
  }
  return descendants;
}

async function validateKnowledgeParent(
  workspaceId: string,
  parentId: string | null,
  movingDocId?: string,
) {
  if (parentId === null) return { ok: true as const };
  const parent = await getKnowledgeDocById(workspaceId, parentId);
  if (!parent) return { ok: false as const, reason: "Parent doc not found." };
  if (!parent.isFolder) return { ok: false as const, reason: "Parent must be a folder." };
  if (movingDocId && parent.id === movingDocId) {
    return { ok: false as const, reason: "A doc cannot be its own parent." };
  }
  if (movingDocId) {
    const descendants = new Set(await collectKnowledgeDescendants(workspaceId, movingDocId));
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
  if (!raw) return "orkestrate.space";

  try {
    return new URL(raw).host;
  } catch {
    return raw.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  }
}

async function listWorkspaceCoordinationStates(workspaceId: string): Promise<StoredAgentState[]> {
  const sessions = await db.query.agentSessions.findMany({
    where: and(eq(agentSessions.workspaceId, workspaceId), eq(agentSessions.status, "active")),
  });

  const bucket = getWorkspaceBucket(workspaceId);
  const rows: StoredAgentState[] = [];
  for (const session of sessions) {
    const state = await db.query.agentStates.findFirst({
      where: eq(agentStates.sessionId, session.id),
    });

    const agentId = session.agentId.split("::")[1] || session.agentId;
    const metadata = bucket.agentMetadata.get(session.agentId);

    // Provide safe fallbacks if the agent hasn't published state yet
    const content: AgentStateContent = {
      agentProfile: metadata?.agentProfile || `${agentId} - coordination agent`,
      currentObjective: state?.objective || "Standing by for next task.",
      architectureFootprint: state && Array.isArray(state.footprint) ? state.footprint : [],
      implementationPlan: state && Array.isArray(state.plan) ? state.plan : [],
      notesForTeam: state?.notes || "",
      pastWorkSummary: metadata?.pastWorkSummary || (state && Array.isArray(state.completed) ? state.completed : []),
    };

    const statusValue = state?.status;

    rows.push({
      scopedAgentId: session.agentId,
      agentId,
      toolName: session.toolNameRaw || null,
      status:
        statusValue === "planning" ? "planning"
          : statusValue === "handoff" ? "handoff"
            : statusValue === "done" ? "done"
              : statusValue === "blocked" ? "blocked"
                : statusValue === "idle" ? "idle"
                  : "active",
      content,
      objective: content.currentObjective,
      footprint: content.architectureFootprint,
      plan: content.implementationPlan,
      notes: content.notesForTeam,
      completed: content.pastWorkSummary,
      repo: {
        canonicalRemote: state?.gitRemote || "",
        branch: state?.gitBranch || session.branchAtJoin,
        headSha: state?.gitHeadSha || session.headShaAtJoin,
        dirty: state?.gitUncommittedChanges || false,
        aheadBehind: state?.gitAheadBehind || null,
      },
      updatedAt: (state?.updatedAt || session.updatedAt).toISOString(),
    });
  }

  return rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

async function workspaceStateHash(workspaceId: string) {
  const sessions = await db.query.agentSessions.findMany({
    where: and(eq(agentSessions.workspaceId, workspaceId), eq(agentSessions.status, "active")),
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

  const now = new Date();
  const claims = await db.query.agentScopeClaims.findMany({
    where: and(eq(agentScopeClaims.workspaceId, workspaceId), eq(agentScopeClaims.status, "active")),
  });
  for (const claim of claims) {
    if (claim.leaseExpiresAt <= now) continue;
    signatures.push([
      claim.id,
      claim.agentId,
      claim.updatedAt.toISOString(),
      claim.leaseExpiresAt.toISOString(),
      JSON.stringify(Array.isArray(claim.paths) ? claim.paths : []),
    ].join(":"));
  }

  const digest = createHash("sha1").update(signatures.sort().join("|")).digest("hex").slice(0, 12);
  return `v${digest}`;
}

async function expireStaleScopeClaims(workspaceId: string, now: Date) {
  await db
    .update(agentScopeClaims)
    .set({ status: "expired", updatedAt: now })
    .where(and(
      eq(agentScopeClaims.workspaceId, workspaceId),
      eq(agentScopeClaims.status, "active"),
      lte(agentScopeClaims.leaseExpiresAt, now),
    ));
}

async function listActiveScopeClaims(workspaceId: string): Promise<ActiveScopeClaim[]> {
  const now = new Date();
  await expireStaleScopeClaims(workspaceId, now);
  const rows = await db.query.agentScopeClaims.findMany({
    where: and(eq(agentScopeClaims.workspaceId, workspaceId), eq(agentScopeClaims.status, "active")),
    orderBy: [desc(agentScopeClaims.updatedAt)],
  });

  return rows.map((row) => ({
    claimId: row.id,
    scopedAgentId: row.agentId,
    agentId: row.agentId.split("::")[1] || row.agentId,
    paths: normalizeScopePaths(row.paths),
    leaseExpiresAt: row.leaseExpiresAt.toISOString(),
  }));
}

function getUnreadMessagesAlert(bucket: WorkspaceBucket, agentId: string): string[] {
  if (!bucket.readReceipts) bucket.readReceipts = new Map();
  if (!bucket.messages) bucket.messages = [];

  let receipts = bucket.readReceipts.get(agentId);
  if (!receipts) {
    receipts = new Set();
    bucket.readReceipts.set(agentId, receipts);
  }
  let unreadCount = 0;
  for (const msg of bucket.messages) {
    if ((msg.toAgentId === agentId || msg.toAgentId === "@everyone") && !receipts.has(msg.id)) {
      unreadCount++;
    }
  }
  if (unreadCount > 0) {
    return [`You have ${unreadCount} unread message(s). Call read_messages immediately to read them.`];
  }
  return [];
}

function buildJoinWorkspaceOrchestrationGuide(workspaceId: string, canonicalAgentId: string) {
  return [
    "Orkestrate coordination instructions:",
    `- workspaceId: ${workspaceId}`,
    `- canonicalAgentId: ${canonicalAgentId}`,
    "",
    "Coordination loop (run in this order):",
    "1) identify_intent for the current task prompt.",
    "2) read_team_state and capture stateHash.",
    "3) claim_scope with expectedStateHash=stateHash and your intended paths (editable intents only).",
    "4) update_my_state with expectedStateHash from latest read and your current objective/plan/footprint.",
    "5) Execute your next chunk of work.",
    "6) Whenever you make progress, run update_my_state again with the latest expectedStateHash.",
    "7) If claim_scope or update_my_state returns hash mismatch/conflict, run read_team_state and retry with the new stateHash.",
    "8) release_scope (or publish idle/done/handoff state with empty footprint to auto-release claims).",
    "",
    "Behavior rules:",
    "- identify_intent is required before write coordination tools.",
    "- non-edit intents cannot claim scope and must publish empty footprint.",
    "- claim_scope is strict: overlapping paths are rejected by server.",
    "- Keep implementationPlan concrete and short; update it as soon as priorities change.",
    "- Use notesForTeam for handoffs, risks, and irreversible decisions.",
    "- IMPORTANT: If your state is empty (e.g., this is a new session), run update_my_state with a solid agentProfile and short currentObjective as soon as possible to announce yourself to the dashboard.",
    "- You can send messages to other agents via send_message. You can use @everyone to broadcast.",
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
      name: "identify_intent",
      description: "Classify the current user request into an intent and return the required coordination workflow. WHEN: call first for every new task-like prompt. WHY: it selects a safe execution pattern and unlocks write tools in the correct order.",
      inputSchema: {
        type: "object",
        properties: {
          userPrompt: {
            type: "string",
            description: "Current user task request in plain language.",
          },
          targetAgentId: {
            type: "string",
            description: "Optional target agent hint for delegate/assist intents.",
          },
          scopeHints: {
            type: "array",
            items: { type: "string" },
            description: "Optional candidate paths to include in returned recommendations.",
          },
          forceIntent: {
            type: "string",
            enum: ["implement", "assist", "delegate", "observe", "review", "handoff"],
            description: "Optional explicit intent override.",
          },
          chain: {
            type: "array",
            items: { type: "string", enum: ["implement", "assist", "delegate", "observe", "review", "handoff"] },
            description: "Optional simple intent chain queue for this session.",
          },
        },
        required: ["userPrompt"],
        additionalProperties: false,
      },
    },
    {
      name: "join_workspace",
      description: "Join the workspace and verify repository identity. WHEN: call at session start or reconnect. WHY: coordination tools are invalid until a verified session exists.",
      inputSchema: {
        type: "object",
        properties: {
          toolName: {
            type: "string",
            description: "Optional human-readable tool/client name (for example: Windsurf, Warp, Lovable).",
          },
          workspaceId: {
            type: "string",
            description: "Optional workspace id. Defaults to current active workspace for the authenticated user.",
          },
          gitContext: {
            type: "object",
            description: "Required git-derived context from local repository.",
            properties: {
              remote: { type: "string", description: "git remote get-url origin" },
              repoRoot: { type: "string", description: "git rev-parse --show-toplevel" },
              branch: { type: "string", description: "git rev-parse --abbrev-ref HEAD" },
              headSha: { type: "string", description: "git rev-parse HEAD" },
              dirty: { type: "boolean", description: "True if working tree has uncommitted changes." },
              collectedAt: { type: "string", description: "ISO timestamp when git context was captured." },
            },
            required: ["remote", "repoRoot", "branch", "headSha", "dirty", "collectedAt"],
            additionalProperties: false,
          },
        },
        required: ["gitContext"],
        additionalProperties: false,
      },
    },
    {
      name: "read_team_state",
      description: "Read authoritative team state and stateHash. WHEN: call after identify_intent and after any mismatch/conflict. WHY: provides fresh CAS context and active claims before write actions.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: "claim_scope",
      description: "Reserve repo paths with strict overlap rejection. WHEN: call before editing files for editable intents. WHY: prevents concurrent edits on intersecting paths.",
      inputSchema: {
        type: "object",
        properties: {
          expectedStateHash: {
            type: "string",
            description: "Required hash returned by read_team_state for optimistic concurrency.",
          },
          paths: {
            type: "array",
            items: { type: "string" },
            description: "Repo-relative paths/globs to claim.",
            minItems: 1,
          },
          ttlSeconds: {
            type: "number",
            description: "Optional lease TTL seconds (default 900, max 3600).",
          },
        },
        required: ["expectedStateHash", "paths"],
        additionalProperties: false,
      },
    },
    {
      name: "release_scope",
      description: "Release one active claim. WHEN: call on completion, handoff, or scope change. WHY: unblocks teammates and closes claim lifecycle cleanly.",
      inputSchema: {
        type: "object",
        properties: {
          claimId: {
            type: "string",
            description: "Claim id returned by claim_scope.",
          },
        },
        required: ["claimId"],
        additionalProperties: false,
      },
    },
    {
      name: "update_my_state",
      description: "Publish objective, footprint, plan, notes, and repo context. WHEN: call after claim and at progress checkpoints; non-edit intents must use empty footprint. WHY: keeps shared state consistent and auditable.",
      inputSchema: {
        type: "object",
        properties: {
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
                enum: ["active", "idle", "blocked", "planning", "handoff", "done"],
                description: "Optional explicit status override.",
              },
              repo: {
                type: "object",
                description: "Required repo context for coordination integrity.",
                properties: {
                  canonicalRemote: { type: "string" },
                  branch: { type: "string" },
                  headSha: { type: "string" },
                  dirty: { type: "boolean" },
                  aheadBehind: { type: "string" },
                },
                required: ["canonicalRemote", "branch", "headSha"],
                additionalProperties: false,
              },
            },
            required: [
              "agentProfile",
              "currentObjective",
              "architectureFootprint",
              "implementationPlan",
              "notesForTeam",
              "pastWorkSummary",
              "repo",
            ],
            additionalProperties: true,
          },
        },
        required: ["content", "expectedStateHash"],
        additionalProperties: false,
      },
    },
    {
      name: "send_message",
      description: "Send a message to another agent or broadcast to all agents. Use this to coordinate, ask for help, or share information directly.",
      inputSchema: {
        type: "object",
        properties: {
          toAgentId: {
            type: "string",
            description: "The targeted agentId (e.g., 'frontend-1'), or '@everyone' to broadcast to the whole team.",
          },
          message: {
            type: "string",
            description: "The message content.",
          },
        },
        required: ["toAgentId", "message"],
        additionalProperties: false,
      },
    },
    {
      name: "read_messages",
      description: "Read all unread messages addressed to you or broadcasted to @everyone. Also marks them as read.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: "read_knowledge_base",
      description: "Read workspace knowledge docs stored in Postgres. Use id for direct read, parentId for folder traversal (parentId:null = root), or query for search.",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Optional doc id for direct read." },
          parentId: { type: ["string", "null"], description: "Optional parent filter. Use null to list root docs." },
          query: { type: "string", description: "Optional case-insensitive search across title/description/content." },
          includeContent: { type: "boolean", description: "Include full content in list responses." },
        },
        additionalProperties: false,
      },
    },
    {
      name: "write_knowledge_base",
      description: "Mutate workspace knowledge docs in Postgres. Supports create/update/move/delete. Parent must be a folder; move cycles are rejected; folder delete cascades descendants.",
      inputSchema: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["create", "update", "move", "delete"] },
          id: { type: "string", description: "Required for update/move/delete." },
          title: { type: "string", description: "Doc title (create/update)." },
          description: { type: "string", description: "Optional doc summary (create/update)." },
          content: { type: "string", description: "Doc body (create/update)." },
          parentId: { type: ["string", "null"], description: "Folder parent id or null for root." },
          isFolder: { type: "boolean", description: "Create as folder when true." },
        },
        required: ["action"],
        additionalProperties: false,
      },
    },
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
      resolveAgentFingerprint({
        explicitAgentId: requestedAgentId,
        clientId,
        userId,
        familyHint: clientName || clientId,
      });

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

    const rawScope = String((tokenRecord as any).scope || "").trim();
    const effectiveScope = rawScope || "mcp:read mcp:write";
    const scopeSet = new Set(
      effectiveScope
        .split(/\s+/)
        .map((part) => part.trim())
        .filter((part) => Boolean(part)),
    );
    const hasReadScope = scopeSet.has("mcp:read") || scopeSet.has("mcp:write");
    const hasWriteScope = scopeSet.has("mcp:write");

    const writeTools = new Set(["join_workspace", "claim_scope", "release_scope", "update_my_state", "write_knowledge_base"]);
    const readTools = new Set(["Orkestrate_initialize", "identify_intent", "read_team_state", "read_knowledge_base"]);

    if (writeTools.has(aliasName) && !hasWriteScope) {
      return json(403, rpcError(id, -32001, "insufficient_scope: requires mcp:write"));
    }
    if (readTools.has(aliasName) && !hasReadScope) {
      return json(403, rpcError(id, -32001, "insufficient_scope: requires mcp:read"));
    }

    if (aliasName === "Orkestrate_initialize") {
      const workspaceId = await ensureActiveWorkspaceForUser(userId);
      if (!workspaceId) {
        return json(200, rpcResult(id, {
          content: [{ type: "text", text: "ERROR: No active workspace found. Please create one in the dashboard first." }]
        }));
      }
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
        workspaceId,
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
      const scopedAgentId = canonicalIdentity.id;
      const workspaceId = typeof argsObj.workspaceId === "string" ? argsObj.workspaceId : undefined;
      const rawToolName = typeof argsObj.toolName === "string" ? argsObj.toolName.trim() : "";
      const toolName = rawToolName ? rawToolName.slice(0, 80) : null;
      const persistedClientName = toolName || canonicalIdentity.family;

      // Extract git context from agent
      const gitContext = argsObj.gitContext && typeof argsObj.gitContext === "object" && !Array.isArray(argsObj.gitContext)
        ? argsObj.gitContext as Record<string, unknown>
        : null;
      const gitRemote = gitContext && typeof gitContext.remote === "string" ? gitContext.remote.trim() : "";
      const repoRoot = gitContext && typeof gitContext.repoRoot === "string" ? gitContext.repoRoot.trim() : "";
      const gitBranch = gitContext && typeof gitContext.branch === "string" ? gitContext.branch.trim() : "";
      const gitHeadSha = gitContext && typeof gitContext.headSha === "string" ? gitContext.headSha.trim() : "";
      const gitDirty = gitContext ? gitContext.dirty : undefined;
      const collectedAt = gitContext && typeof gitContext.collectedAt === "string" ? gitContext.collectedAt.trim() : "";

      if (!gitContext) {
        return json(200, rpcResult(id, {
          content: [
            { type: "text", text: "ERROR: join_workspace requires gitContext." },
            ...workflowContentEntries({
              ok: false,
              intentId: null,
              phase: "none",
              nextRequiredTool: "join_workspace",
              why: "Repository verification requires gitContext in join request.",
              recoverySteps: [
                "Collect git remote, repoRoot, branch, headSha, dirty, and collectedAt.",
                "Retry join_workspace with complete gitContext.",
              ],
              errorCode: "WORKFLOW_STEP_VIOLATION",
              allowedToolsNow: ["join_workspace"],
            }),
          ],
        }));
      }
      if (!gitRemote || !repoRoot || !gitBranch || !isValidHeadSha(gitHeadSha)) {
        return json(200, rpcResult(id, {
          content: [
            { type: "text", text: "ERROR: Invalid gitContext. remote, repoRoot, branch, and valid headSha are required." },
            ...workflowContentEntries({
              ok: false,
              intentId: null,
              phase: "none",
              nextRequiredTool: "join_workspace",
              why: "join_workspace requires complete git identity fields.",
              recoverySteps: [
                "Verify git commands return non-empty values.",
                "Retry join_workspace with valid gitContext payload.",
              ],
              errorCode: "WORKFLOW_STEP_VIOLATION",
              allowedToolsNow: ["join_workspace"],
            }),
          ],
        }));
      }
      if (typeof gitDirty !== "boolean") {
        return json(200, rpcResult(id, {
          content: [
            { type: "text", text: "ERROR: Invalid gitContext. dirty must be boolean." },
            ...workflowContentEntries({
              ok: false,
              intentId: null,
              phase: "none",
              nextRequiredTool: "join_workspace",
              why: "dirty flag type must be boolean for deterministic repo checks.",
              recoverySteps: ["Set gitContext.dirty to true/false and retry join_workspace."],
              errorCode: "WORKFLOW_STEP_VIOLATION",
              allowedToolsNow: ["join_workspace"],
            }),
          ],
        }));
      }
      if (!collectedAt || Number.isNaN(Date.parse(collectedAt))) {
        return json(200, rpcResult(id, {
          content: [
            { type: "text", text: "ERROR: Invalid gitContext. collectedAt must be an ISO timestamp." },
            ...workflowContentEntries({
              ok: false,
              intentId: null,
              phase: "none",
              nextRequiredTool: "join_workspace",
              why: "join_workspace requires parseable ISO timestamp in gitContext.collectedAt.",
              recoverySteps: ["Provide an ISO timestamp string and retry join_workspace."],
              errorCode: "WORKFLOW_STEP_VIOLATION",
              allowedToolsNow: ["join_workspace"],
            }),
          ],
        }));
      }

      const normalizedRemote = normalizeGitUrl(gitRemote);

      const joined = await joinWorkspaceForAgent({
        userId,
        scopedAgentId,
        toolName: persistedClientName,
        label: canonicalIdentity.id,
        workspaceId,
        gitRemote,
        gitBranch,
        gitHeadSha,
        repoRoot,
        toolNameRaw: toolName || null,
        normalizedGitRemote: normalizedRemote,
      });

      if (!joined.ok) {
        const errorDetails = 'details' in joined && joined.details
          ? `\n\nDetails:\n- Agent repo: ${joined.details.agentRepo || 'none'}\n- Workspace repo: ${joined.details.workspaceRepo || 'none'}`
          : '';
        return json(200, rpcResult(id, {
          content: [
            { type: "text", text: `ERROR: ${joined.reason}${errorDetails}` },
            ...workflowContentEntries({
              ok: false,
              intentId: null,
              phase: "none",
              nextRequiredTool: "join_workspace",
              why: "Join guard rejected this session context.",
              recoverySteps: [
                "Match local repo remote with workspace repo binding.",
                "Retry join_workspace with corrected gitContext.",
              ],
              errorCode: "WORKFLOW_STEP_VIOLATION",
              allowedToolsNow: ["join_workspace"],
            }),
          ],
        }));
      }
      const orchestrationGuide = buildJoinWorkspaceOrchestrationGuide(joined.workspaceId, canonicalIdentity.id);

      return json(200, rpcResult(id, {
        content: [
          ...(aliasNotice ? [{ type: "text", text: aliasNotice }] : []),
          { type: "text", text: `Joined workspace ${joined.workspaceId} as ${canonicalIdentity.id}.` },
          ...workflowContentEntries({
            ok: true,
            intentId: null,
            phase: "none",
            nextRequiredTool: "identify_intent",
            why: "Session is verified. Identify the current task intent before write coordination calls.",
            recommendedArgs: { userPrompt: "Describe current task." },
          }),
          { type: "text", text: orchestrationGuide },
          {
            type: "text", text: JSON.stringify({
              workspaceId: joined.workspaceId,
              sessionId: joined.sessionId,
              canonicalAgentId: canonicalIdentity.id,
              scopedAgentId,
              toolName: persistedClientName,
              family: canonicalIdentity.family,
              repoVerified: true,
              normalizedRemote,
              branch: gitBranch,
              headSha: gitHeadSha,
              policy: {
                overlapPolicy: "strict_reject",
                branchPolicy: "same_repo_any_branch",
              },
            }, null, 2)
          },
        ],
      }));
    }

    const resolveJoinedContext = async (argsObj: Record<string, unknown>) => {
      const canonicalIdentity = resolveAgentIdentity(argsObj.agentId);
      const scopedAgentId = canonicalIdentity.id;
      const joined = await getJoinedWorkspaceForAgent(userId, scopedAgentId);
      return { canonicalIdentity, scopedAgentId, joined };
    };

    if (aliasName === "identify_intent") {
      const argsObj = args as Record<string, unknown>;
      const userPrompt = typeof argsObj.userPrompt === "string" ? argsObj.userPrompt.trim() : "";
      if (!userPrompt) {
        return json(400, rpcError(id, -32602, "Requires string argument 'userPrompt'."));
      }

      const { canonicalIdentity, scopedAgentId, joined } = await resolveJoinedContext(argsObj);
      if (!joined) {
        return json(200, rpcResult(id, {
          content: [
            { type: "text", text: "ERROR: Agent not joined. Call join_workspace first." },
            ...workflowContentEntries({
              ok: false,
              intentId: null,
              phase: "none",
              errorCode: "WORKFLOW_REQUIRED",
              nextRequiredTool: "join_workspace",
              why: "identify_intent requires an active joined session to create workflow run state.",
              recoverySteps: [
                "Call join_workspace with gitContext.",
                "Retry identify_intent for this task prompt.",
              ],
              allowedToolsNow: ["join_workspace"],
            }),
          ],
        }));
      }

      const workspaceId = joined.workspaceId;
      await touchAgentSession(scopedAgentId, joined.sessionId);

      const chainQueue = normalizeIntentChain(argsObj.chain);
      const resolution = resolveIntent(userPrompt, argsObj.forceIntent);
      const intentDef = getIntentDefinition(resolution.intentId);
      const bucket = getWorkspaceBucket(workspaceId);
      const run = createWorkflowRun({
        sessionId: joined.sessionId,
        scopedAgentId,
        intentId: resolution.intentId,
        editable: resolution.editable,
        chainQueue,
      });
      setSessionWorkflowRun(bucket, run);

      const targetAgentId = typeof argsObj.targetAgentId === "string" ? argsObj.targetAgentId.trim() : "";
      const scopeHints = normalizeScopePaths(argsObj.scopeHints);

      const instructions = [
        {
          tool: "read_team_state",
          when: "Immediately after identify_intent.",
          why: "Fetch the latest stateHash and active claims before any write.",
        },
        ...(resolution.editable
          ? [{
            tool: "claim_scope",
            when: "After read_team_state, before editing files.",
            why: "Reserve non-overlapping scope and enforce deterministic ownership.",
          }, {
            tool: "update_my_state",
            when: "After claim_scope and at progress checkpoints.",
            why: "Broadcast objective/footprint and keep team state consistent.",
          }]
          : [{
            tool: "update_my_state",
            when: "After read_team_state with empty architectureFootprint.",
            why: "Publish non-edit intent updates without claiming paths.",
          }]),
      ];

      return json(200, rpcResult(id, {
        content: [
          ...(aliasNotice ? [{ type: "text", text: aliasNotice }] : []),
          { type: "text", text: `Identified intent '${resolution.intentId}' for ${canonicalIdentity.id}.` },
          ...workflowContentEntries({
            ok: true,
            intentId: resolution.intentId,
            phase: run.phase,
            nextRequiredTool: "read_team_state",
            why: "Workflow starts with a fresh team-state read for CAS-safe execution.",
            recommendedArgs: { agentId: canonicalIdentity.id },
          }),
          {
            type: "text",
            text: JSON.stringify({
              intentId: resolution.intentId,
              confidence: resolution.confidence,
              editable: intentDef.editable,
              phase: run.phase,
              nextRequiredTool: "read_team_state",
              forbiddenTools: intentDef.forbiddenTools,
              instructions,
              run: {
                runId: run.runId,
                sessionId: run.sessionId,
                intentId: run.intentId,
                phase: run.phase,
                chainRemaining: run.chainQueue,
                expiresAt: run.expiresAt,
              },
              targetAgentId: targetAgentId || null,
              scopeHints,
              systemAlerts: getUnreadMessagesAlert(getWorkspaceBucket(workspaceId), canonicalIdentity.id),
            }, null, 2),
          },
        ],
      }));
    }

    if (aliasName === "read_team_state") {
      const argsObj = args as Record<string, unknown>;
      const { canonicalIdentity, scopedAgentId, joined } = await resolveJoinedContext(argsObj);
      if (!joined) {
        return json(200, rpcResult(id, {
          content: [
            { type: "text", text: "ERROR: Agent not joined. Call join_workspace first." },
            ...workflowContentEntries({
              ok: false,
              intentId: null,
              phase: "none",
              nextRequiredTool: "join_workspace",
              why: "A verified session is required before team state can be read.",
              recoverySteps: [
                "Call join_workspace with valid gitContext.",
                "Retry read_team_state.",
              ],
              errorCode: "WORKFLOW_REQUIRED",
              allowedToolsNow: ["join_workspace"],
            }),
          ],
        }));
      }

      const workspaceId = joined.workspaceId;
      await touchAgentSession(scopedAgentId, joined.sessionId);
      const agents = await listWorkspaceCoordinationStates(workspaceId);
      const activeClaims = await listActiveScopeClaims(workspaceId);
      const stateHash = await workspaceStateHash(workspaceId);
      const bucket = getWorkspaceBucket(workspaceId);
      const existingRun = getSessionWorkflowRun(bucket, scopedAgentId, joined.sessionId);
      const run = existingRun
        ? touchRun(existingRun, { phase: "read", lastReadStateHash: stateHash })
        : null;
      if (run) setSessionWorkflowRun(bucket, run);

      const agentsPayload = agents.map((state) => ({
        agentId: state.agentId,
        toolName: state.toolName,
        status: state.status,
        objective: state.objective,
        footprint: state.footprint,
        branch: state.repo.branch,
        headSha: state.repo.headSha,
        updatedAt: state.updatedAt,
      }));

      const summary = agents.length > 0
        ? agents
          .map((state) => `- ${state.agentId} (${state.status}) objective: ${state.content.currentObjective} | footprint: ${state.content.architectureFootprint.length} paths`)
          .join("\n")
        : "[No agents have published state yet.]";

      return json(200, rpcResult(id, {
        content: [
          ...(aliasNotice ? [{ type: "text", text: aliasNotice }] : []),
          { type: "text", text: summary },
          ...workflowContentEntries({
            ok: true,
            intentId: run?.intentId || null,
            phase: run?.phase || "none",
            nextRequiredTool: run ? (run.editable ? "claim_scope" : "update_my_state") : "identify_intent",
            why: run
              ? "Team state is fresh. Continue the active intent workflow with the next required tool."
              : "No active intent run found. Identify intent before attempting write coordination tools.",
            recommendedArgs: run
              ? { expectedStateHash: stateHash }
              : { userPrompt: "Describe your current task." },
          }),
          { type: "text", text: `stateHash=${stateHash}` },
          {
            type: "text",
            text: JSON.stringify({
              workspaceId,
              canonicalAgentId: canonicalIdentity.id,
              scopedAgentId,
              stateHash,
              agents: agentsPayload,
              activeClaims,
              systemAlerts: getUnreadMessagesAlert(bucket, canonicalIdentity.id),
            }, null, 2),
          },
        ],
      }));
    }

    if (aliasName === "claim_scope") {
      const argsObj = args as Record<string, unknown>;
      if (typeof argsObj.expectedStateHash !== "string") {
        return json(400, rpcError(id, -32602, "Requires string argument 'expectedStateHash'."));
      }
      const paths = normalizeScopePaths(argsObj.paths);
      if (paths.length === 0) {
        return json(400, rpcError(id, -32602, "Requires non-empty array argument 'paths'."));
      }

      const { canonicalIdentity, scopedAgentId, joined } = await resolveJoinedContext(argsObj);
      if (!joined) {
        return json(200, rpcResult(id, {
          content: [
            { type: "text", text: "ERROR: Agent not joined. Call join_workspace first." },
            ...workflowContentEntries({
              ok: false,
              intentId: null,
              phase: "none",
              nextRequiredTool: "join_workspace",
              why: "Scope claims are invalid until a verified workspace session exists.",
              recoverySteps: [
                "Call join_workspace with valid gitContext.",
                "Call identify_intent, then read_team_state, then retry claim_scope.",
              ],
              errorCode: "WORKFLOW_REQUIRED",
              allowedToolsNow: ["join_workspace"],
            }),
          ],
        }));
      }

      const workspaceId = joined.workspaceId;
      await touchAgentSession(scopedAgentId, joined.sessionId);
      const bucket = getWorkspaceBucket(workspaceId);
      const existingRun = getSessionWorkflowRun(bucket, scopedAgentId, joined.sessionId);
      const guard = enforceWriteToolGuard({
        toolName: "claim_scope",
        run: existingRun,
      });
      if (!guard.ok) {
        return json(200, rpcResult(id, {
          content: [
            { type: "text", text: `ERROR: ${guard.errorCode}.` },
            ...workflowContentEntries({
              ok: false,
              intentId: existingRun?.intentId || null,
              phase: guard.currentPhase,
              nextRequiredTool: guard.nextRequiredTool,
              why: guard.why,
              recoverySteps: guard.recoverySteps,
              errorCode: guard.errorCode,
              allowedToolsNow: guard.allowedToolsNow,
            }),
          ],
        }));
      }
      await expireStaleScopeClaims(workspaceId, new Date());
      const currentHash = await workspaceStateHash(workspaceId);
      if (argsObj.expectedStateHash !== currentHash) {
        if (existingRun) {
          setSessionWorkflowRun(bucket, setRunPhase(existingRun, "resync"));
        }
        return json(200, rpcResult(id, {
          content: [
            { type: "text", text: "ERROR: Team state changed. Call read_team_state again and retry." },
            { type: "text", text: `currentStateHash=${currentHash}` },
            ...workflowContentEntries({
              ok: false,
              intentId: existingRun?.intentId || null,
              phase: "resync",
              nextRequiredTool: "read_team_state",
              why: "Hash mismatch indicates stale coordination view.",
              recoverySteps: [
                "Call read_team_state and capture new stateHash.",
                "Retry claim_scope with expectedStateHash from the fresh read.",
              ],
              errorCode: "WORKFLOW_RESYNC_REQUIRED",
              allowedToolsNow: ["read_team_state"],
            }),
          ],
        }));
      }

      const activeClaims = await listActiveScopeClaims(workspaceId);
      const conflicts = activeClaims
        .filter((claim) => claim.scopedAgentId !== scopedAgentId && findScopeConflicts(paths, claim.paths))
        .map((claim) => ({
          claimId: claim.claimId,
          agentId: claim.agentId,
          paths: claim.paths,
        }));

      if (conflicts.length > 0) {
        if (existingRun) {
          setSessionWorkflowRun(bucket, setRunPhase(existingRun, "resync"));
        }
        return json(200, rpcResult(id, {
          content: [{
            type: "text",
            text: JSON.stringify({
              error: "SCOPE_CONFLICT",
              conflicts,
              currentStateHash: await workspaceStateHash(workspaceId),
            }, null, 2),
          },
          ...workflowContentEntries({
            ok: false,
            intentId: existingRun?.intentId || null,
            phase: "resync",
            nextRequiredTool: "read_team_state",
            why: "Scope conflict requires a fresh read and re-scope attempt.",
            recoverySteps: [
              "Call read_team_state to inspect active claims.",
              "Pick non-overlapping paths and retry claim_scope.",
            ],
            errorCode: "WORKFLOW_RESYNC_REQUIRED",
            allowedToolsNow: ["read_team_state"],
          })],
        }));
      }

      const ttlParsed = typeof argsObj.ttlSeconds === "number" ? argsObj.ttlSeconds : Number(argsObj.ttlSeconds);
      const ttlSeconds = Number.isFinite(ttlParsed)
        ? Math.min(MAX_SCOPE_TTL_SECONDS, Math.max(30, Math.floor(ttlParsed)))
        : DEFAULT_SCOPE_TTL_SECONDS;

      const now = new Date();
      await db
        .update(agentScopeClaims)
        .set({ status: "released", updatedAt: now })
        .where(and(
          eq(agentScopeClaims.workspaceId, workspaceId),
          eq(agentScopeClaims.agentId, scopedAgentId),
          eq(agentScopeClaims.status, "active"),
        ));

      const claimId = `claim_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
      const leaseExpiresAt = new Date(now.getTime() + (ttlSeconds * 1000));
      await db.insert(agentScopeClaims).values({
        id: claimId,
        workspaceId,
        agentId: scopedAgentId,
        sessionId: joined.sessionId,
        paths,
        status: "active",
        leaseExpiresAt,
        createdAt: now,
        updatedAt: now,
      });
      if (existingRun) {
        setSessionWorkflowRun(bucket, setRunPhase(existingRun, "claimed"));
      }

      return json(200, rpcResult(id, {
        content: [
          ...(aliasNotice ? [{ type: "text", text: aliasNotice }] : []),
          { type: "text", text: `Scope claimed for ${canonicalIdentity.id}.` },
          ...workflowContentEntries({
            ok: true,
            intentId: existingRun?.intentId || null,
            phase: "claimed",
            nextRequiredTool: "update_my_state",
            why: "Scope is reserved. Publish state next before or while editing files.",
            recommendedArgs: { expectedStateHash: await workspaceStateHash(workspaceId) },
          }),
          {
            type: "text",
            text: JSON.stringify({
              workspaceId,
              claim: {
                claimId,
                agentId: canonicalIdentity.id,
                paths,
                leaseExpiresAt: leaseExpiresAt.toISOString(),
              },
              stateHash: await workspaceStateHash(workspaceId),
            }, null, 2),
          },
        ],
      }));
    }

    if (aliasName === "release_scope") {
      const argsObj = args as Record<string, unknown>;
      const claimId = typeof argsObj.claimId === "string" ? argsObj.claimId.trim() : "";
      if (!claimId) {
        return json(400, rpcError(id, -32602, "Requires string argument 'claimId'."));
      }

      const { canonicalIdentity, scopedAgentId, joined } = await resolveJoinedContext(argsObj);
      if (!joined) {
        return json(200, rpcResult(id, {
          content: [
            { type: "text", text: "ERROR: Agent not joined. Call join_workspace first." },
            ...workflowContentEntries({
              ok: false,
              intentId: null,
              phase: "none",
              nextRequiredTool: "join_workspace",
              why: "Scope release requires a verified workspace session.",
              recoverySteps: [
                "Call join_workspace with valid gitContext.",
                "Retry release_scope with your claimId.",
              ],
              errorCode: "WORKFLOW_REQUIRED",
              allowedToolsNow: ["join_workspace"],
            }),
          ],
        }));
      }

      const workspaceId = joined.workspaceId;
      await touchAgentSession(scopedAgentId, joined.sessionId);
      const bucket = getWorkspaceBucket(workspaceId);
      const existingRun = getSessionWorkflowRun(bucket, scopedAgentId, joined.sessionId);
      const guard = enforceWriteToolGuard({
        toolName: "release_scope",
        run: existingRun,
      });
      if (!guard.ok) {
        return json(200, rpcResult(id, {
          content: [
            { type: "text", text: `ERROR: ${guard.errorCode}.` },
            ...workflowContentEntries({
              ok: false,
              intentId: existingRun?.intentId || null,
              phase: guard.currentPhase,
              nextRequiredTool: guard.nextRequiredTool,
              why: guard.why,
              recoverySteps: guard.recoverySteps,
              errorCode: guard.errorCode,
              allowedToolsNow: guard.allowedToolsNow,
            }),
          ],
        }));
      }
      const existing = await db.query.agentScopeClaims.findFirst({
        where: and(eq(agentScopeClaims.id, claimId), eq(agentScopeClaims.workspaceId, workspaceId)),
      });
      if (!existing) {
        return json(404, rpcError(id, -32004, "Scope claim not found."));
      }
      if (existing.agentId !== scopedAgentId) {
        return json(403, rpcError(id, -32003, "Cannot release a claim owned by another agent."));
      }

      await db
        .update(agentScopeClaims)
        .set({ status: "released", updatedAt: new Date() })
        .where(eq(agentScopeClaims.id, claimId));

      let nextPhase: WorkflowPhase = "done";
      let nextIntentId: IntentId | null = existingRun?.intentId || null;
      if (existingRun) {
        const queue = [...existingRun.chainQueue];
        if (queue.length > 0) {
          const nextIntent = queue.shift()!;
          const def = getIntentDefinition(nextIntent);
          const nextRun = touchRun(existingRun, {
            intentId: nextIntent,
            editable: def.editable,
            phase: "identified",
            chainQueue: queue,
            lastReadStateHash: null,
          });
          setSessionWorkflowRun(bucket, nextRun);
          nextPhase = "identified";
          nextIntentId = nextIntent;
        } else {
          setSessionWorkflowRun(bucket, setRunPhase(existingRun, "done"));
        }
      }

      return json(200, rpcResult(id, {
        content: [
          ...(aliasNotice ? [{ type: "text", text: aliasNotice }] : []),
          { type: "text", text: `Released scope claim ${claimId} for ${canonicalIdentity.id}.` },
          ...workflowContentEntries({
            ok: true,
            intentId: nextIntentId,
            phase: nextPhase,
            nextRequiredTool: nextPhase === "identified" ? "read_team_state" : "identify_intent",
            why: nextPhase === "identified"
              ? "Next chained intent is queued and ready for a fresh team-state read."
              : "Claim released and workflow is complete.",
          }),
          {
            type: "text",
            text: JSON.stringify({
              workspaceId,
              claimId,
              stateHash: await workspaceStateHash(workspaceId),
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
          content: [
            { type: "text", text: "ERROR: Agent not joined. Call join_workspace first." },
            ...workflowContentEntries({
              ok: false,
              intentId: null,
              phase: "none",
              nextRequiredTool: "join_workspace",
              why: "State updates are invalid until a verified workspace session exists.",
              recoverySteps: [
                "Call join_workspace with valid gitContext.",
                "Call identify_intent and continue workflow before retrying update_my_state.",
              ],
              errorCode: "WORKFLOW_REQUIRED",
              allowedToolsNow: ["join_workspace"],
            }),
          ],
        }));
      }

      const workspaceId = joined.workspaceId;
      await touchAgentSession(scopedAgentId, joined.sessionId);
      const bucket = getWorkspaceBucket(workspaceId);
      const existingRun = getSessionWorkflowRun(bucket, scopedAgentId, joined.sessionId);
      const guard = enforceWriteToolGuard({
        toolName: "update_my_state",
        run: existingRun,
        hasNonEmptyFootprint: hasNonEmptyArchitectureFootprint(argsObj.content),
      });
      if (!guard.ok) {
        return json(200, rpcResult(id, {
          content: [
            { type: "text", text: `ERROR: ${guard.errorCode}.` },
            ...workflowContentEntries({
              ok: false,
              intentId: existingRun?.intentId || null,
              phase: guard.currentPhase,
              nextRequiredTool: guard.nextRequiredTool,
              why: guard.why,
              recoverySteps: guard.recoverySteps,
              errorCode: guard.errorCode,
              allowedToolsNow: guard.allowedToolsNow,
            }),
          ],
        }));
      }
      const currentHash = await workspaceStateHash(workspaceId);

      if (argsObj.expectedStateHash !== currentHash) {
        if (existingRun) {
          setSessionWorkflowRun(bucket, setRunPhase(existingRun, "resync"));
        }
        return json(200, rpcResult(id, {
          content: [
            { type: "text", text: "ERROR: Team state changed. Call read_team_state again and retry." },
            { type: "text", text: `currentStateHash=${currentHash}` },
            ...workflowContentEntries({
              ok: false,
              intentId: existingRun?.intentId || null,
              phase: "resync",
              nextRequiredTool: "read_team_state",
              why: "Hash mismatch indicates stale team-state context for update.",
              recoverySteps: [
                "Call read_team_state to fetch new stateHash.",
                "Retry update_my_state with expectedStateHash from that read.",
              ],
              errorCode: "WORKFLOW_RESYNC_REQUIRED",
              allowedToolsNow: ["read_team_state"],
            }),
          ],
        }));
      }

      const next = coerceState(scopedAgentId, canonicalIdentity.id, argsObj.content);
      const session = await db.query.agentSessions.findFirst({ where: eq(agentSessions.id, joined.sessionId) });
      if (!session) {
        return json(500, rpcError(id, -32000, "Joined session not found."));
      }

      if (!next.repo.canonicalRemote || !next.repo.branch || !next.repo.headSha || !isValidHeadSha(next.repo.headSha)) {
        return json(400, rpcError(id, -32602, "content.repo.canonicalRemote, content.repo.branch, and valid content.repo.headSha are required."));
      }

      const expectedRemote = normalizeGitUrl(session.normalizedRemote || "");
      const providedRemote = normalizeGitUrl(next.repo.canonicalRemote || "");
      if (expectedRemote && providedRemote !== expectedRemote) {
        return json(200, rpcResult(id, {
          content: [
            {
              type: "text",
              text: `ERROR: Repo mismatch. sessionRemote=${session.normalizedRemote || "unknown"} providedRemote=${next.repo.canonicalRemote}`,
            },
            ...workflowContentEntries({
              ok: false,
              intentId: existingRun?.intentId || null,
              phase: existingRun?.phase || "none",
              nextRequiredTool: "join_workspace",
              why: "Repo context no longer matches joined session identity.",
              recoverySteps: [
                "Ensure your local repository remote matches the workspace canonical remote.",
                "Re-run join_workspace with fresh gitContext, then continue workflow.",
              ],
              errorCode: "WORKFLOW_STEP_VIOLATION",
              allowedToolsNow: ["join_workspace"],
            }),
          ],
        }));
      }

      if (next.footprint.length > 0) {
        const ownedActiveClaims = (await listActiveScopeClaims(workspaceId))
          .filter((claim) => claim.scopedAgentId === scopedAgentId);
        if (ownedActiveClaims.length === 0) {
          if (existingRun) {
            setSessionWorkflowRun(bucket, setRunPhase(existingRun, "resync"));
          }
          return json(200, rpcResult(id, {
            content: [
              { type: "text", text: "ERROR: No active scope claim. Call claim_scope before publishing non-empty architectureFootprint." },
              ...workflowContentEntries({
                ok: false,
                intentId: existingRun?.intentId || null,
                phase: "resync",
                nextRequiredTool: "read_team_state",
                why: "Footprint update requires an active claim and fresh state synchronization.",
                recoverySteps: [
                  "Call read_team_state to refresh hash.",
                  "Call claim_scope for the intended paths.",
                  "Retry update_my_state with non-empty footprint.",
                ],
                errorCode: "WORKFLOW_STEP_VIOLATION",
                allowedToolsNow: ["read_team_state", "claim_scope"],
              }),
            ],
          }));
        }

        const claimPaths = ownedActiveClaims.flatMap((claim) => claim.paths);
        const missingPaths = next.footprint.filter((path) => !claimPaths.some((claimPath) => claimPathCovers(claimPath, path)));
        if (missingPaths.length > 0) {
          return json(200, rpcResult(id, {
            content: [{
              type: "text",
              text: JSON.stringify({
                error: "FOOTPRINT_OUTSIDE_CLAIM",
                missingPaths,
                claimPaths,
              }, null, 2),
            },
            ...workflowContentEntries({
              ok: false,
              intentId: existingRun?.intentId || null,
              phase: existingRun?.phase || "none",
              nextRequiredTool: "claim_scope",
              why: "Footprint includes paths that are not covered by active claim.",
              recoverySteps: [
                "Adjust architectureFootprint to claimed paths, or",
                "Claim broader/non-overlapping paths first, then retry.",
              ],
              errorCode: "WORKFLOW_STEP_VIOLATION",
              allowedToolsNow: ["claim_scope", "update_my_state"],
            })],
          }));
        }
      }

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
          workspaceId,
          status: next.status,
          objective: next.objective,
          footprint: next.footprint,
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
            footprint: next.footprint,
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

      if (
        next.footprint.length === 0 &&
        (next.status === "idle" || next.status === "done" || next.status === "handoff")
      ) {
        await db
          .update(agentScopeClaims)
          .set({ status: "released", updatedAt: new Date() })
          .where(and(
            eq(agentScopeClaims.workspaceId, workspaceId),
            eq(agentScopeClaims.agentId, scopedAgentId),
            eq(agentScopeClaims.status, "active"),
          ));
      }

      let nextWorkflowPhase: WorkflowPhase = next.footprint.length > 0 ? "active" : "active";
      let nextIntentId: IntentId | null = existingRun?.intentId || null;
      if (next.footprint.length === 0 && (next.status === "done" || next.status === "handoff")) {
        nextWorkflowPhase = "done";
      }
      if (existingRun) {
        if (nextWorkflowPhase === "done" && existingRun.chainQueue.length > 0) {
          const queue = [...existingRun.chainQueue];
          const chainedIntent = queue.shift()!;
          const chainedDef = getIntentDefinition(chainedIntent);
          const chainedRun = touchRun(existingRun, {
            intentId: chainedIntent,
            editable: chainedDef.editable,
            phase: "identified",
            chainQueue: queue,
            lastReadStateHash: null,
          });
          setSessionWorkflowRun(bucket, chainedRun);
          nextWorkflowPhase = "identified";
          nextIntentId = chainedIntent;
        } else {
          setSessionWorkflowRun(bucket, setRunPhase(existingRun, nextWorkflowPhase));
        }
      }

      const nextRequiredTool = nextWorkflowPhase === "identified"
        ? "read_team_state"
        : nextWorkflowPhase === "done"
          ? "identify_intent"
          : "update_my_state";
      const nextWhy = nextWorkflowPhase === "identified"
        ? "Chained intent is queued. Refresh team state before continuing."
        : nextWorkflowPhase === "done"
          ? "Current intent is complete."
          : "Continue publishing progress updates for the active intent.";

      return json(200, rpcResult(id, {
        content: [
          ...(aliasNotice ? [{ type: "text", text: aliasNotice }] : []),
          { type: "text", text: `Successfully updated state for ${canonicalIdentity.id}.` },
          ...workflowContentEntries({
            ok: true,
            intentId: nextIntentId,
            phase: nextWorkflowPhase,
            nextRequiredTool,
            why: nextWhy,
            recommendedArgs: nextRequiredTool === "read_team_state"
              ? {}
              : nextRequiredTool === "identify_intent"
                ? { userPrompt: "Describe the next task." }
                : { expectedStateHash: await workspaceStateHash(workspaceId) },
          }),
          { type: "text", text: `stateHash=${await workspaceStateHash(workspaceId)}` },
          {
            type: "text",
            text: JSON.stringify({
              workspaceId,
              state: next,
              systemAlerts: getUnreadMessagesAlert(bucket, canonicalIdentity.id),
            }, null, 2),
          },
        ],
      }));
    }

    if (aliasName === "send_message") {
      const argsObj = args as Record<string, unknown>;
      const toAgentId = typeof argsObj.toAgentId === "string" ? argsObj.toAgentId.trim() : "";
      const messageContent = typeof argsObj.message === "string" ? argsObj.message.trim() : "";
      if (!toAgentId || !messageContent) {
        return json(400, rpcError(id, -32602, "Requires string arguments 'toAgentId' and 'message'."));
      }

      const { canonicalIdentity, scopedAgentId, joined } = await resolveJoinedContext(argsObj);
      if (!joined) {
        return json(200, rpcResult(id, {
          content: [{ type: "text", text: "ERROR: Agent not joined. Call join_workspace first." }],
        }));
      }

      const workspaceId = joined.workspaceId;
      await touchAgentSession(scopedAgentId, joined.sessionId);
      const bucket = getWorkspaceBucket(workspaceId);
      if (!bucket.messages) bucket.messages = [];
      if (!bucket.readReceipts) bucket.readReceipts = new Map();

      const msgId = `msg_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
      bucket.messages.push({
        id: msgId,
        fromAgentId: canonicalIdentity.id,
        toAgentId,
        content: messageContent,
        timestamp: new Date().toISOString(),
      });
      // Limit to last 200 messages in memory to prevent leak
      if (bucket.messages.length > 200) {
        bucket.messages.shift();
      }

      return json(200, rpcResult(id, {
        content: [
          { type: "text", text: `Message sent to ${toAgentId}. They will be notified via systemAlerts on their next state update or read.` },
        ],
      }));
    }

    if (aliasName === "read_messages") {
      const argsObj = args as Record<string, unknown>;
      const { canonicalIdentity, scopedAgentId, joined } = await resolveJoinedContext(argsObj);
      if (!joined) {
        return json(200, rpcResult(id, {
          content: [{ type: "text", text: "ERROR: Agent not joined. Call join_workspace first." }],
        }));
      }

      const workspaceId = joined.workspaceId;
      await touchAgentSession(scopedAgentId, joined.sessionId);
      const bucket = getWorkspaceBucket(workspaceId);
      if (!bucket.messages) bucket.messages = [];
      if (!bucket.readReceipts) bucket.readReceipts = new Map();

      let receipts = bucket.readReceipts.get(canonicalIdentity.id);
      if (!receipts) {
        receipts = new Set();
        bucket.readReceipts.set(canonicalIdentity.id, receipts);
      }

      const unread: AgentMessage[] = [];
      for (const msg of bucket.messages) {
        if ((msg.toAgentId === canonicalIdentity.id || msg.toAgentId === "@everyone") && !receipts.has(msg.id)) {
          unread.push(msg);
          receipts.add(msg.id);
        }
      }

      return json(200, rpcResult(id, {
        content: [
          {
            type: "text",
            text: unread.length === 0
              ? "You have no unread messages."
              : `You have ${unread.length} new message(s).`
          },
          ...(unread.length > 0 ? [{
            type: "text",
            text: JSON.stringify({ messages: unread }, null, 2),
          }] : []),
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

      const workspaceId = joined.workspaceId;
      await touchAgentSession(scopedAgentId, joined.sessionId);

      const idArg = typeof argsObj.id === "string" ? argsObj.id : null;
      const hasParentFilter = Object.prototype.hasOwnProperty.call(argsObj, "parentId");
      const parentIdArg = typeof argsObj.parentId === "string"
        ? argsObj.parentId.trim()
        : (argsObj.parentId === null ? null : undefined);
      const queryArg = typeof argsObj.query === "string" ? argsObj.query.trim().toLowerCase() : "";
      const includeContent = Boolean(argsObj.includeContent);

      if (idArg) {
        const row = await getKnowledgeDocById(workspaceId, idArg);
        const doc = row ? mapKnowledgeDocRow(row) : null;
        return json(200, rpcResult(id, {
          content: [{ type: "text", text: JSON.stringify({ workspaceId, doc }, null, 2) }],
        }));
      }

      const whereClauses: Array<ReturnType<typeof eq> | ReturnType<typeof isNull> | ReturnType<typeof or>> = [
        eq(knowledgeDocs.workspaceId, workspaceId),
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
        content: [{ type: "text", text: JSON.stringify({ workspaceId, count: docs.length, docs }, null, 2) }],
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

      const workspaceId = joined.workspaceId;
      await touchAgentSession(scopedAgentId, joined.sessionId);
      const action = typeof argsObj.action === "string" ? argsObj.action : "";

      if (action === "create") {
        const now = new Date().toISOString();
        const parentId = typeof argsObj.parentId === "string" ? argsObj.parentId.trim() : null;
        const parentCheck = await validateKnowledgeParent(workspaceId, parentId);
        if (!parentCheck.ok) return json(400, rpcError(id, -32602, parentCheck.reason));

        const title = typeof argsObj.title === "string" && argsObj.title.trim() ? argsObj.title.trim() : "Untitled";
        const docId = `kb_${randomUUID().replace(/-/g, "").slice(0, 20)}`;
        await db.insert(knowledgeDocs).values({
          id: docId,
          workspaceId,
          title,
          description: typeof argsObj.description === "string" ? argsObj.description.trim() : "",
          content: typeof argsObj.content === "string" ? argsObj.content : "",
          parentId,
          isFolder: Boolean(argsObj.isFolder),
          createdAt: new Date(now),
          updatedAt: new Date(now),
        });
        const inserted = await getKnowledgeDocById(workspaceId, docId);
        const doc = inserted ? mapKnowledgeDocRow(inserted) : null;

        return json(200, rpcResult(id, {
          content: [{ type: "text", text: JSON.stringify({ workspaceId, doc }, null, 2) }],
        }));
      }

      if (action === "update") {
        const idTrimmed = typeof argsObj.id === "string" ? argsObj.id.trim() : "";
        if (!idTrimmed) {
          return json(400, rpcError(id, -32602, "Missing id for update."));
        }

        const existing = await getKnowledgeDocById(workspaceId, idTrimmed);
        if (!existing) {
          return json(404, rpcError(id, -32004, "Knowledge doc not found."));
        }

        const nextParent = typeof argsObj.parentId === "string"
          ? argsObj.parentId.trim()
          : (argsObj.parentId === null ? null : existing.parentId);
        const parentCheck = await validateKnowledgeParent(workspaceId, nextParent, existing.id);
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
          .where(and(eq(knowledgeDocs.id, existing.id), eq(knowledgeDocs.workspaceId, workspaceId)));
        const refreshed = await getKnowledgeDocById(workspaceId, existing.id);
        const updated = refreshed ? mapKnowledgeDocRow(refreshed) : null;

        return json(200, rpcResult(id, {
          content: [{ type: "text", text: JSON.stringify({ workspaceId, doc: updated }, null, 2) }],
        }));
      }

      if (action === "move") {
        const idTrimmed = typeof argsObj.id === "string" ? argsObj.id.trim() : "";
        if (!idTrimmed) {
          return json(400, rpcError(id, -32602, "Missing id for move."));
        }

        const existing = await getKnowledgeDocById(workspaceId, idTrimmed);
        if (!existing) {
          return json(404, rpcError(id, -32004, "Knowledge doc not found."));
        }

        const nextParent = typeof argsObj.parentId === "string"
          ? argsObj.parentId.trim()
          : null;
        const parentCheck = await validateKnowledgeParent(workspaceId, nextParent, existing.id);
        if (!parentCheck.ok) return json(400, rpcError(id, -32602, parentCheck.reason));

        await db
          .update(knowledgeDocs)
          .set({
            parentId: nextParent,
            updatedAt: new Date(),
          })
          .where(and(eq(knowledgeDocs.id, existing.id), eq(knowledgeDocs.workspaceId, workspaceId)));
        const refreshed = await getKnowledgeDocById(workspaceId, existing.id);
        const updated = refreshed ? mapKnowledgeDocRow(refreshed) : null;

        return json(200, rpcResult(id, {
          content: [{ type: "text", text: JSON.stringify({ workspaceId, doc: updated }, null, 2) }],
        }));
      }

      if (action === "delete") {
        const idTrimmed = typeof argsObj.id === "string" ? argsObj.id.trim() : "";
        if (!idTrimmed) {
          return json(400, rpcError(id, -32602, "Missing id for delete."));
        }

        const existing = await getKnowledgeDocById(workspaceId, idTrimmed);
        if (!existing) {
          return json(404, rpcError(id, -32004, "Knowledge doc not found."));
        }

        const descendants = await collectKnowledgeDescendants(workspaceId, existing.id);
        if (descendants.length > 0) {
          await db
            .delete(knowledgeDocs)
            .where(and(eq(knowledgeDocs.workspaceId, workspaceId), or(...descendants.map((descId) => eq(knowledgeDocs.id, descId)))!));
        }
        await db
          .delete(knowledgeDocs)
          .where(and(eq(knowledgeDocs.workspaceId, workspaceId), eq(knowledgeDocs.id, existing.id)));

        return json(200, rpcResult(id, {
          content: [{ type: "text", text: JSON.stringify({ workspaceId, deleted: true, deletedCount: descendants.length + 1, doc: mapKnowledgeDocRow(existing) }, null, 2) }],
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

