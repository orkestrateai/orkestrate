import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { authenticateRequestUser } from "@/lib/auth-user-request";
import { canAccessWorkspace } from "@/lib/workspaces-core";
import { enqueueAgentCommand } from "@/lib/agent-command-queue";
import { db } from "@/db";
import { agents } from "@/db/schema";

function noStoreJson(payload: unknown, status = 200) {
  return NextResponse.json(payload, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  try {
    const user = await authenticateRequestUser(req);
    if (!user?.id) return noStoreJson({ error: "Unauthorized" }, 401);

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId.trim() : "";
    const scopedAgentId = typeof body.scopedAgentId === "string" ? body.scopedAgentId.trim() : "";
    const text = typeof body.text === "string" ? body.text.trim() : "";

    if (!workspaceId || !scopedAgentId || !text) {
      return noStoreJson({ error: "Missing workspaceId, scopedAgentId, or text." }, 400);
    }

    const allowed = await canAccessWorkspace(user.id, workspaceId);
    if (!allowed) return noStoreJson({ error: "Workspace not accessible" }, 403);

    const agent = await db.query.agents.findFirst({ where: eq(agents.id, scopedAgentId) });
    if (!agent || agent.roomId !== workspaceId) {
      return noStoreJson({ error: "Agent not found in workspace." }, 404);
    }

    const command = enqueueAgentCommand(scopedAgentId, workspaceId, text);
    return noStoreJson({ accepted: true, commandId: command.id });
  } catch (error) {
    return noStoreJson({ error: "Internal server error", detail: error instanceof Error ? error.message : String(error) }, 500);
  }
}
