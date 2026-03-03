import type { NextApiRequest, NextApiResponse } from "next";
import { and, eq, ilike, or } from "drizzle-orm";
import { bearerToken, json, sendOAuthChallenge } from "@/lib/http";
import { createServiceClient } from "@/lib/supabase";
import { getClientRegistration, validateAccessToken } from "@/lib/oauth-store";
import { ensureActiveWorkspaceForUser } from "@/lib/workspaces";
import {
  buildScopedClientId,
  resolveCanonicalAgentIdentity,
  sanitizeAgentId,
} from "@/lib/agent-identity";
import {
  getTeamStateForProject,
  getDashboardAgentStatesForProject,
  upsertAgentState,
} from "@/lib/shared-workspace";
import {
  ensureWorkspaceCodebaseMatch,
  getWorkspaceCanonicalRemote,
  normalizeRepoSnapshot,
} from "@/lib/repo-identity";
import { listRecentActivity } from "@/lib/agent-activity";
import { db } from "@/db";
import { knowledgeDocs } from "@/db/schema";

function rpcResult(id: any, result: any) {
  return { jsonrpc: "2.0", id, result };
}

function rpcError(id: any, code: number, message: string) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}


function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter((v) => Boolean(v));
}

function coerceLegacyOrV2State(content: unknown): Record<string, unknown> | null {
  if (!content || typeof content !== "object" || Array.isArray(content)) {
    return null;
  }
  const obj = content as Record<string, unknown>;

  const objective =
    typeof obj.objective === "string" && obj.objective.trim()
      ? obj.objective.trim()
      : typeof obj.currentObjective === "string" && obj.currentObjective.trim()
        ? obj.currentObjective.trim()
        : null;
  if (!objective) return null;

  const status = typeof obj.status === "string" && obj.status.trim()
    ? obj.status.trim().toLowerCase()
    : objective.toLowerCase().includes("standing by")
      ? "idle"
      : "active";

  const claimedPaths = toStringArray(obj.claimedPaths).length > 0
    ? toStringArray(obj.claimedPaths)
    : toStringArray(obj.architectureFootprint);

  const plan = toStringArray(obj.plan).length > 0
    ? toStringArray(obj.plan)
    : toStringArray(obj.implementationPlan);

  const notes =
    typeof obj.notes === "string" && obj.notes.trim()
      ? obj.notes.trim()
      : typeof obj.notesForTeam === "string" && obj.notesForTeam.trim()
        ? obj.notesForTeam.trim()
        : "None";

  const completed = toStringArray(obj.completed).length > 0
    ? toStringArray(obj.completed)
    : toStringArray(obj.pastWorkSummary);

  return {
    status: status === "blocked" ? "blocked" : status === "idle" ? "idle" : "active",
    objective,
    claimedPaths,
    plan,
    notes,
    completed,
    repo: normalizeRepoSnapshot(obj.repo),
    agentProfile:
      typeof obj.agentProfile === "string" && obj.agentProfile.trim()
        ? obj.agentProfile.trim()
        : "Agent",
  };
}

function normalizePath(path: string): string {
  return path
    .trim()
    .replace(/\\/g, "/")
    .replace(/\/{2,}/g, "/")
    .replace(/^\.\//, "")
    .replace(/\/+$/, "")
    .toLowerCase();
}

function expandClaimPrefix(claim: string): string {
  const normalized = normalizePath(claim);
  if (normalized.includes("*")) return normalized.split("*")[0].replace(/\/+$/, "");
  return normalized;
}

function hasPathOverlap(a: string, b: string): boolean {
  const left = expandClaimPrefix(a);
  const right = expandClaimPrefix(b);
  if (!left || !right) return false;
  return (
    left === right ||
    left.startsWith(`${right}/`) ||
    right.startsWith(`${left}/`)
  );
}

function buildCollisionWarnings(states: Array<{ agentId: string; stateContent: any }>) {
  const warnings: Array<{ agents: [string, string]; pathA: string; pathB: string }> = [];
  for (let i = 0; i < states.length; i += 1) {
    const leftClaims = toStringArray(states[i].stateContent?.claimedPaths);
    for (let j = i + 1; j < states.length; j += 1) {
      const rightClaims = toStringArray(states[j].stateContent?.claimedPaths);
      for (const left of leftClaims) {
        const overlapping = rightClaims.find((right) => hasPathOverlap(left, right));
        if (!overlapping) continue;
        warnings.push({
          agents: [states[i].agentId, states[j].agentId],
          pathA: left,
          pathB: overlapping,
        });
      }
    }
  }
  return warnings;
}

function buildMcpToolList() {
  return [
    {
      name: "Orkestrate_initialize",
      description:
        "Compatibility onboarding helper. Returns setup and collaboration instructions for this workspace and agent.",
      inputSchema: {
        type: "object",
        properties: {
          agentId: {
            type: "string",
            description: "Optional agent id hint.",
          },
        },
        additionalProperties: false,
      },
    },
    {
      name: "read_agent_state",
      description:
        "Read live team coordination state, including declared plans, observed edit activity, collision warnings, and codebase match status for the current workspace.",
      inputSchema: {
        type: "object",
        properties: {
          agentId: {
            type: "string",
            description: "Optional short slot hint (main, a-h, 1-8).",
          },
        },
        additionalProperties: false,
      },
    },
    {
      name: "write_agent_state",
      description:
        "Write your declared coordination state (status, objective, claimed paths, plan, notes, completed items, repo metadata). Requires expectedStateHash from read_agent_state.",
      inputSchema: {
        type: "object",
        properties: {
          agentId: {
            type: "string",
            description: "Optional short slot hint used with read_agent_state.",
          },
          content: {
            type: "object",
            properties: {
              status: { enum: ["active", "idle", "blocked"] },
              objective: { type: "string" },
              claimedPaths: { type: "array", items: { type: "string" } },
              plan: { type: "array", items: { type: "string" } },
              notes: { type: "string" },
              completed: { type: "array", items: { type: "string" } },
              repo: {
                type: "object",
                properties: {
                  canonicalRemote: { type: "string" },
                  branch: { type: "string" },
                  headSha: { type: "string" },
                  dirty: { type: "boolean" },
                },
              },
            },
            required: ["status", "objective", "claimedPaths", "plan", "notes", "completed"],
          },
          expectedStateHash: {
            type: "string",
            description: "State hash returned by read_agent_state.",
          },
        },
        required: ["content", "expectedStateHash"],
      },
    },
    {
      name: "read_knowledge_base",
      description:
        "Read workspace knowledge docs and folders. Supports listing, id lookup, and text search.",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string" },
          parentId: { type: "string" },
          query: { type: "string" },
          includeContent: { type: "boolean" },
        },
        additionalProperties: false,
      },
    },
    {
      name: "write_knowledge_base",
      description:
        "Create, update, move, or delete knowledge-base files/folders.",
      inputSchema: {
        type: "object",
        properties: {
          action: { enum: ["create", "update", "move", "delete"] },
          id: { type: "string" },
          title: { type: "string" },
          description: { type: "string" },
          content: { type: "string" },
          parentId: { type: "string" },
          isFolder: { type: "boolean" },
        },
        required: ["action"],
      },
    },
  ];
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "POST") {
      return json(res, 405, { error: "Method Not Allowed" });
    }

    const client = createServiceClient();
    const token = bearerToken(req);
    const tokenRecord = await validateAccessToken(client, token || "");
    if (!tokenRecord) return sendOAuthChallenge(res, req);

    const rpc = req.body;
    if (!rpc || rpc.jsonrpc !== "2.0" || typeof rpc.method !== "string") {
      return json(
        res,
        400,
        rpcError(rpc?.id ?? null, -32600, "Invalid JSON-RPC request."),
      );
    }

    const id = rpc.id ?? null;
    const method = rpc.method;
    const params = rpc.params || {};

    const userId = String(tokenRecord.user_id || "");
    const clientId = String(tokenRecord.client_id || "");
    const clientRegistration = await getClientRegistration(client, clientId);
    const clientName = clientRegistration?.client_name || null;
    const resolveAgentIdentity = (requestedAgentId: unknown) =>
      resolveCanonicalAgentIdentity({
        requestedAgentId,
        clientId,
        clientName,
      });

    if (method === "initialize") {
      return json(
        res,
        200,
        rpcResult(id, {
          protocolVersion: "2025-06-18",
          capabilities: { tools: {}, resources: {} },
          serverInfo: { name: "Orkestrate-mcp-vercel", version: "0.7.0" },
        }),
      );
    }

    if (method === "notifications/initialized") {
      return res.status(204).end();
    }

    if (method === "tools/list") {
      return json(res, 200, rpcResult(id, { tools: buildMcpToolList() }));
    }

    if (method !== "tools/call") {
      return json(res, 404, rpcError(id, -32601, `Method '${method}' not found.`));
    }

    const rawName = String(params.name || "");
    const args = params.arguments || {};

    const aliasName = rawName === "read_team_state"
      ? "read_agent_state"
      : rawName === "update_my_state"
        ? "write_agent_state"
        : rawName === "orkestrate_initialize"
          ? "Orkestrate_initialize"
          : rawName;
    const aliasNotice = rawName !== aliasName
      ? `DEPRECATION: '${rawName}' is deprecated; use '${aliasName}'.`
      : null;

    if (aliasName === "Orkestrate_initialize") {
      const workspaceId = await ensureActiveWorkspaceForUser(userId);
      const canonicalIdentity = resolveAgentIdentity(args.agentId);
      const workspaceRemote = await getWorkspaceCanonicalRemote(workspaceId);
      const bootstrapText = [
        "Orkestrate initialization context:",
        `- workspaceId: ${workspaceId}`,
        `- canonicalAgentId: ${canonicalIdentity.id}`,
        `- workspaceCanonicalRemote: ${workspaceRemote || "not-bound-yet"}`,
        "",
        "Core MCP tools:",
        "1) read_agent_state",
        "2) write_agent_state",
        "3) read_knowledge_base",
        "4) write_knowledge_base",
        "",
        "Required collaboration loop:",
        "1) Call read_agent_state first.",
        "2) Use returned stateHash in write_agent_state.expectedStateHash.",
        "3) Keep claimedPaths current for files you touch.",
        "4) Include repo.canonicalRemote/branch/headSha when known.",
        "5) Re-read and retry on stale stateHash conflicts.",
        "",
        "Git policy:",
        "- Git is source of truth for code sharing.",
        "- Use per-agent branches (orkestrate/<agent-id>/<task-slug>).",
        "- Exchange durable work via fetch/rebase/cherry-pick/PR.",
        "",
        "Knowledge base:",
        "- Use read_knowledge_base/write_knowledge_base for architecture decisions, design notes, and team context.",
      ].join("\n");

      return json(
        res,
        200,
        rpcResult(id, {
          content: [
            ...(aliasNotice ? [{ type: "text", text: aliasNotice }] : []),
            { type: "text", text: bootstrapText },
            {
              type: "text",
              text: JSON.stringify(
                {
                  workspaceId,
                  canonicalAgentId: canonicalIdentity.id,
                  workspaceCanonicalRemote: workspaceRemote,
                  canonicalTools: [
                    "read_agent_state",
                    "write_agent_state",
                    "read_knowledge_base",
                    "write_knowledge_base",
                  ],
                },
                null,
                2,
              ),
            },
          ],
        }),
      );
    }

    if (aliasName === "read_agent_state") {
      const workspaceId = await ensureActiveWorkspaceForUser(userId);
      const canonicalIdentity = resolveAgentIdentity(args.agentId);
      const scopedClientId = buildScopedClientId(clientId, canonicalIdentity.id);

      if (clientId && clientId !== "web-dashboard") {
        await upsertAgentState(userId, workspaceId, scopedClientId);
      }

      const teamState = await getTeamStateForProject(userId, workspaceId);
      const workspaceRemote = await getWorkspaceCanonicalRemote(workspaceId);
      const dashboardAgents = await getDashboardAgentStatesForProject(userId, workspaceId, {
        workspaceCanonicalRemote: workspaceRemote,
      });
      const recentActivity = await listRecentActivity({ workspaceId, limit: 75 });
      const collisions = buildCollisionWarnings(
        dashboardAgents.map((agent) => ({
          agentId: agent.agentId,
          stateContent: agent.stateContent,
        })),
      );

      const responseJson = {
        workspaceId,
        canonicalAgentId: canonicalIdentity.id,
        stateHash: teamState.stateHash,
        workspaceCodebase: workspaceRemote,
        agents: dashboardAgents.map((agent) => ({
          agentId: agent.agentId,
          scopedAgentId: agent.stateClientId,
          status: agent.status,
          codebaseMatch: agent.codebaseMatch,
          objective: agent.stateContent.objective,
          claimedPaths: agent.stateContent.claimedPaths,
          plan: agent.stateContent.plan,
          notes: agent.stateContent.notes,
          repo: agent.stateContent.repo,
          lastPingAt: agent.lastPingAt,
        })),
        recentActivity: recentActivity.map((event) => ({
          id: event.id,
          eventType: event.eventType,
          scopedAgentId: event.scopedAgentId,
          payload: event.payload,
          repo: event.repo,
          createdAt: event.createdAt,
        })),
        collisions,
      };

      // Server-side telemetry side-effect
      const telemetryUrl = process.env.NEXT_PUBLIC_SITE_URL
        ? `${process.env.NEXT_PUBLIC_SITE_URL}/api/telemetry/ingest`
        : `http://localhost:${process.env.PORT || 3000}/api/telemetry/ingest`;

      void fetch(`${telemetryUrl}?clientId=${clientId}&agent=${canonicalIdentity.id}&roomId=${workspaceId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "heartbeat",
          type: "heartbeat",
          source: "mcp-server-side",
        }),
      }).catch(() => { });

      return json(
        res,
        200,
        rpcResult(id, {
          content: [
            ...(aliasNotice ? [{ type: "text", text: aliasNotice }] : []),
            {
              type: "text",
              text: teamState.content || "[Orkestrate Agent State: Empty]",
            },
            { type: "text", text: `stateHash=${teamState.stateHash}` },
            { type: "text", text: JSON.stringify(responseJson, null, 2) },
          ],
        }),
      );
    }

    if (aliasName === "write_agent_state") {
      if (
        typeof args.content !== "object" ||
        Array.isArray(args.content) ||
        args.content === null
      ) {
        return json(
          res,
          400,
          rpcError(id, -32602, "Requires object argument 'content'."),
        );
      }
      if (typeof args.expectedStateHash !== "string") {
        return json(
          res,
          400,
          rpcError(id, -32602, "Requires string argument 'expectedStateHash'."),
        );
      }

      const stateObj = coerceLegacyOrV2State(args.content);
      if (!stateObj) {
        return json(
          res,
          400,
          rpcError(
            id,
            -32602,
            "Invalid state content. Expected objective/status/claimedPaths/plan/notes/completed.",
          ),
        );
      }

      const canonicalIdentity = resolveAgentIdentity(args.agentId);
      const scopedClientId = buildScopedClientId(clientId, canonicalIdentity.id);
      const workspaceId = await ensureActiveWorkspaceForUser(userId);
      stateObj.agentProfile = `${canonicalIdentity.family} (${canonicalIdentity.id})`;

      const repo = normalizeRepoSnapshot((stateObj as any).repo);
      const codebaseCheck = await ensureWorkspaceCodebaseMatch({
        workspaceId,
        userId,
        canonicalRemote: repo.canonicalRemote || null,
        defaultBranch: repo.branch || null,
      });

      if (codebaseCheck.status === "mismatch") {
        return json(
          res,
          200,
          rpcResult(id, {
            content: [
              ...(aliasNotice ? [{ type: "text", text: aliasNotice }] : []),
              {
                type: "text",
                text: `ERROR: Repo mismatch. Workspace expects ${codebaseCheck.canonicalRemote}, but received ${codebaseCheck.receivedRemote}.`,
              },
              {
                type: "text",
                text: JSON.stringify(
                  {
                    codebaseMatch: "mismatch",
                    expectedCanonicalRemote: codebaseCheck.canonicalRemote,
                    receivedCanonicalRemote: codebaseCheck.receivedRemote,
                  },
                  null,
                  2,
                ),
              },
            ],
          }),
        );
      }

      try {
        await upsertAgentState(
          userId,
          workspaceId,
          scopedClientId,
          stateObj,
          args.expectedStateHash,
        );
      } catch (e: any) {
        if (String(e?.message || "").includes("409 Conflict")) {
          return json(
            res,
            200,
            rpcResult(id, {
              content: [
                {
                  type: "text",
                  text: "ERROR: Team state changed while you were planning. Call read_agent_state again and retry with the new stateHash.",
                },
              ],
            }),
          );
        }
        if (String(e?.message || "").includes("429 Too Many Requests")) {
          return json(
            res,
            200,
            rpcResult(id, {
              content: [
                {
                  type: "text",
                  text: "ERROR: Rate limit exceeded. Sleep for 60 seconds and retry.",
                },
              ],
            }),
          );
        }
        throw e;
      }

      const telemetryUrl = process.env.NEXT_PUBLIC_SITE_URL
        ? `${process.env.NEXT_PUBLIC_SITE_URL}/api/telemetry/ingest`
        : `http://localhost:${process.env.PORT || 3000}/api/telemetry/ingest`;

      void fetch(`${telemetryUrl}?clientId=${clientId}&agent=${canonicalIdentity.id}&roomId=${workspaceId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "write_agent_state",
          type: "write_agent_state",
          source: "mcp-server-side",
          payload: {
            status: stateObj.status,
            objective: stateObj.objective,
            claimedPaths: stateObj.claimedPaths,
          }
        }),
      }).catch(() => { });

      return json(
        res,
        200,
        rpcResult(id, {
          content: [
            ...(aliasNotice ? [{ type: "text", text: aliasNotice }] : []),
            {
              type: "text",
              text: `Successfully updated state for ${canonicalIdentity.id}.`,
            },
            {
              type: "text",
              text: JSON.stringify(
                {
                  codebaseMatch:
                    codebaseCheck.status === "unknown" ? "unknown" : "matched",
                  workspaceCanonicalRemote:
                    codebaseCheck.status === "unknown"
                      ? null
                      : codebaseCheck.canonicalRemote,
                },
                null,
                2,
              ),
            },
          ],
        }),
      );
    }

    if (aliasName === "read_knowledge_base") {
      const workspaceId = await ensureActiveWorkspaceForUser(userId);
      const docId = typeof args.id === "string" ? args.id : null;
      const parentId = typeof args.parentId === "string" ? args.parentId : null;
      const query = typeof args.query === "string" ? args.query.trim() : "";
      const includeContent = Boolean(args.includeContent);

      if (docId) {
        const doc = await db.query.knowledgeDocs.findFirst({
          where: and(
            eq(knowledgeDocs.workspaceId, workspaceId),
            eq(knowledgeDocs.id, docId),
          ),
        });
        return json(
          res,
          200,
          rpcResult(id, {
            content: [
              ...(aliasNotice ? [{ type: "text", text: aliasNotice }] : []),
              {
                type: "text",
                text: JSON.stringify({ workspaceId, doc: doc || null }, null, 2),
              },
            ],
          }),
        );
      }

      const where = query
        ? and(
          eq(knowledgeDocs.workspaceId, workspaceId),
          or(
            ilike(knowledgeDocs.title, `%${query}%`),
            ilike(knowledgeDocs.description, `%${query}%`),
            ilike(knowledgeDocs.content, `%${query}%`),
          ),
        )
        : parentId
          ? and(
            eq(knowledgeDocs.workspaceId, workspaceId),
            eq(knowledgeDocs.parentId, parentId as any),
          )
          : eq(knowledgeDocs.workspaceId, workspaceId);

      const docs = await db.query.knowledgeDocs.findMany({
        where,
        orderBy: (table, { asc }) => [asc(table.title)],
      });

      const mapped = docs.map((doc) => ({
        ...doc,
        content: includeContent ? doc.content : "",
      }));

      return json(
        res,
        200,
        rpcResult(id, {
          content: [
            ...(aliasNotice ? [{ type: "text", text: aliasNotice }] : []),
            {
              type: "text",
              text: JSON.stringify({ workspaceId, docs: mapped }, null, 2),
            },
          ],
        }),
      );
    }

    if (aliasName === "write_knowledge_base") {
      const workspaceId = await ensureActiveWorkspaceForUser(userId);
      const action = typeof args.action === "string" ? args.action : "";

      if (action === "create") {
        const title =
          typeof args.title === "string" && args.title.trim()
            ? args.title.trim()
            : "Untitled";
        const description =
          typeof args.description === "string" ? args.description : "";
        const content = typeof args.content === "string" ? args.content : "";
        const parentId = typeof args.parentId === "string" ? args.parentId : null;
        const isFolder = Boolean(args.isFolder);

        const [doc] = await db
          .insert(knowledgeDocs)
          .values({
            workspaceId,
            title,
            description,
            content,
            parentId,
            isFolder,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        return json(
          res,
          200,
          rpcResult(id, {
            content: [{ type: "text", text: JSON.stringify({ doc }, null, 2) }],
          }),
        );
      }

      if (action === "update") {
        if (typeof args.id !== "string" || !args.id.trim()) {
          return json(res, 400, rpcError(id, -32602, "Missing id for update."));
        }

        const patch: Record<string, unknown> = { updatedAt: new Date() };
        if (typeof args.title === "string") patch.title = args.title;
        if (typeof args.description === "string") patch.description = args.description;
        if (typeof args.content === "string") patch.content = args.content;
        if (typeof args.parentId === "string") patch.parentId = args.parentId;

        const [doc] = await db
          .update(knowledgeDocs)
          .set(patch)
          .where(
            and(
              eq(knowledgeDocs.id, args.id),
              eq(knowledgeDocs.workspaceId, workspaceId),
            ),
          )
          .returning();

        if (!doc) {
          return json(res, 404, rpcError(id, -32004, "Knowledge doc not found."));
        }

        return json(
          res,
          200,
          rpcResult(id, {
            content: [{ type: "text", text: JSON.stringify({ doc }, null, 2) }],
          }),
        );
      }

      if (action === "move") {
        if (typeof args.id !== "string" || !args.id.trim()) {
          return json(res, 400, rpcError(id, -32602, "Missing id for move."));
        }
        const parentId = typeof args.parentId === "string" ? args.parentId : null;
        const [doc] = await db
          .update(knowledgeDocs)
          .set({ parentId, updatedAt: new Date() })
          .where(
            and(
              eq(knowledgeDocs.id, args.id),
              eq(knowledgeDocs.workspaceId, workspaceId),
            ),
          )
          .returning();

        if (!doc) {
          return json(res, 404, rpcError(id, -32004, "Knowledge doc not found."));
        }

        return json(
          res,
          200,
          rpcResult(id, {
            content: [{ type: "text", text: JSON.stringify({ doc }, null, 2) }],
          }),
        );
      }

      if (action === "delete") {
        if (typeof args.id !== "string" || !args.id.trim()) {
          return json(res, 400, rpcError(id, -32602, "Missing id for delete."));
        }

        const [doc] = await db
          .delete(knowledgeDocs)
          .where(
            and(
              eq(knowledgeDocs.id, args.id),
              eq(knowledgeDocs.workspaceId, workspaceId),
            ),
          )
          .returning();

        if (!doc) {
          return json(res, 404, rpcError(id, -32004, "Knowledge doc not found."));
        }

        return json(
          res,
          200,
          rpcResult(id, {
            content: [{ type: "text", text: JSON.stringify({ deleted: true, doc }, null, 2) }],
          }),
        );
      }

      return json(
        res,
        400,
        rpcError(
          id,
          -32602,
          "Unsupported action. Allowed: create, update, move, delete.",
        ),
      );
    }

    return json(res, 400, rpcError(id, -32602, `Unknown tool '${rawName}'.`));
  } catch (error) {
    return json(res, 500, {
      error: "Internal server error",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}
