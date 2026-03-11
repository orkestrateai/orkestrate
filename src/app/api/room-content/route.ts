import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { authenticateRequestUser } from "@/lib/auth-user-request";
import { canAccessWorkspace, ensureActiveWorkspaceForUser } from "@/lib/workspaces-core";
import { db } from "@/db";
import { agents, agentSessions, agentStates } from "@/db/schema";
import { reconcileWorkspaceAgentLiveness } from "@/lib/agents-core";

function noStoreJson(payload: unknown, status = 200) {
  return NextResponse.json(payload, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(req: NextRequest) {
  try {
    const user = await authenticateRequestUser(req);
    if (!user?.id) return noStoreJson({ error: "Unauthorized" }, 401);

    const workspaceIdParam = req.nextUrl.searchParams.get("workspaceId") || "";
    const workspaceId = workspaceIdParam || await ensureActiveWorkspaceForUser(user.id);

    if (!workspaceId) {
      return noStoreJson({ error: "No workspace available" }, 404);
    }

    const allowed = await canAccessWorkspace(user.id, workspaceId);
    if (!allowed) return noStoreJson({ error: "Workspace not accessible" }, 403);
    await reconcileWorkspaceAgentLiveness();

    const roomAgents = await db.select().from(agents).where(eq(agents.roomId, workspaceId)).orderBy(desc(agents.updatedAt));

    const mappedAgents = await Promise.all(roomAgents.map(async (agent) => {
      const session = await db.query.agentSessions.findFirst({
        where: and(eq(agentSessions.agentId, agent.id), eq(agentSessions.roomId, workspaceId), eq(agentSessions.status, "active")),
        orderBy: [desc(agentSessions.startedAt)],
      });
      const state = session ? await db.query.agentStates.findFirst({ where: eq(agentStates.sessionId, session.id) }) : null;
      const lastPingAt = (session?.lastMessageAt || agent.lastMessageAt || agent.updatedAt).toISOString();
      const status = agent.status === "disconnected"
        ? "disconnected"
        : agent.status === "idle"
          ? "offline"
          : "online";
      const pluginConnected = Boolean(agent.pluginConnectedAt);

      return {
        stateClientId: agent.id,
        clientBaseId: agent.id.split("::")[0] || agent.id,
        memberId: agent.memberId,
        agentId: agent.label,
        displayName: agent.label,
        status,
        lastPingAt,
        agentProfile: agent.client,
        currentObjective: state?.objective || "Standing by.",
        pluginConnected,
        activeSessionId: session?.id || null,
        canViewChat: pluginConnected && Boolean(session?.id),
        stateContent: state ? {
          objective: state.objective,
          status: state.status,
          claimedPaths: state.claimedPaths,
          plan: state.plan,
          completed: state.completed,
          notes: state.notes,
          version: state.version,
          updatedAt: state.updatedAt,
        } : {},
      };
    }));

    return noStoreJson({ workspaceId, roomId: workspaceId, agents: mappedAgents, tasks: [], knowledgeBase: [], recentActivity: [], recentConflicts: [] });
  } catch (error) {
    return noStoreJson({ error: "Internal server error", detail: error instanceof Error ? error.message : String(error) }, 500);
  }
}
