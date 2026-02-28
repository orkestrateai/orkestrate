import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { canAccessWorkspace } from "@/lib/workspaces";
import { enqueueAgentCommand } from "@/lib/agent-control";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.slice(7);
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const workspaceId = (typeof body?.workspaceId === "string" ? body.workspaceId : (typeof body?.roomId === "string" ? body.roomId : ""));
    const scopedAgentId = typeof body?.scopedAgentId === "string" ? body.scopedAgentId : "";
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    const sessionId = typeof body?.sessionId === "string" ? body.sessionId : null;

    if (!workspaceId || !scopedAgentId || !text) {
      return NextResponse.json({ error: "Missing workspaceId, scopedAgentId, or text" }, { status: 400 });
    }

    const canAccess = await canAccessWorkspace(user.id, workspaceId);
    if (!canAccess) {
      return NextResponse.json({ error: "Workspace not accessible" }, { status: 403 });
    }

    const command = await enqueueAgentCommand({ roomId: workspaceId, scopedAgentId, sessionId, text });
    return NextResponse.json({ ok: true, command });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error", detail: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
