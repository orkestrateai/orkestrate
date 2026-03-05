import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { agentSessions } from "@/db/schema";
import { authenticateRequestUser } from "@/lib/auth-user-request";
import { canAccessWorkspace, ensureActiveWorkspaceForUser } from "@/lib/workspaces-core";
import { reconcileWorkspaceAgentLiveness } from "@/lib/agents-core";

function noStoreJson(payload: unknown, status = 200) {
  return NextResponse.json(payload, { status, headers: { "Cache-Control": "no-store" } });
}

function toSessionTitle(index: number) {
  return `Session ${index}`;
}

export async function GET(req: NextRequest) {
  try {
    const user = await authenticateRequestUser(req);
    if (!user?.id) return noStoreJson({ error: "Unauthorized" }, 401);

    const workspaceIdParam = req.nextUrl.searchParams.get("workspaceId") || "";
    const scopedAgentId = req.nextUrl.searchParams.get("scopedAgentId") || "";
    if (!scopedAgentId) return noStoreJson({ error: "Missing scopedAgentId" }, 400);

    const workspaceId = workspaceIdParam || await ensureActiveWorkspaceForUser(user.id);
    const allowed = await canAccessWorkspace(user.id, workspaceId);
    if (!allowed) return noStoreJson({ error: "Workspace not accessible" }, 403);
    await reconcileWorkspaceAgentLiveness(workspaceId);

    const activeOnly = req.nextUrl.searchParams.get("activeOnly") === "true";
    const rows = await db.select().from(agentSessions)
      .where(and(
        eq(agentSessions.roomId, workspaceId),
        eq(agentSessions.agentId, scopedAgentId),
        ...(activeOnly ? [eq(agentSessions.status, "active" as const)] : []),
      ))
      .orderBy(desc(agentSessions.startedAt))
      .limit(activeOnly ? 1 : 50);

    const sessions = rows.map((row, idx) => ({
      id: row.id,
      title: toSessionTitle(rows.length - idx),
      startedAt: row.startedAt.toISOString(),
      endedAt: row.endedAt ? row.endedAt.toISOString() : null,
      status: row.status,
      objective: "Coordination session",
      eventCount: 0,
      unresolved: 0,
      summary: row.status === "active" ? "Active session" : "Completed session",
      contextWindow: "n/a",
      tools: [],
      confidence: 0.9,
      agent: scopedAgentId.split("::")[1] || scopedAgentId,
      role: "agent",
      repo: "workspace",
      branch: "unknown",
      model: "unknown",
    }));

    const activeRow = rows[0] || null;
    const logs = activeRow && Array.isArray(activeRow.transcript)
      ? (activeRow.transcript as Array<Record<string, unknown>>)
      : [];

    return noStoreJson({ sessions, activeSessionId: activeRow?.id || null, logs });
  } catch (error) {
    return noStoreJson({ error: "Internal server error", detail: error instanceof Error ? error.message : String(error) }, 500);
  }
}
