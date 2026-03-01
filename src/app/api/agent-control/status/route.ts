import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { listAgentCommands } from "@/lib/agent-control";
import { canAccessWorkspace } from "@/lib/workspaces";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
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
    const {
      data: { user },
    } = await supabase.auth.getUser(token);
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const workspaceId = (searchParams.get("workspaceId") || searchParams.get("roomId")) || "";
    const scopedAgentId = searchParams.get("scopedAgentId") || "";
    const sessionId = searchParams.get("sessionId") || null;
    const parsedLimit = Number(searchParams.get("limit") || "");
    const limit = Number.isFinite(parsedLimit) ? parsedLimit : undefined;

    if (!workspaceId || !scopedAgentId) {
      return NextResponse.json({ error: "Missing workspaceId or scopedAgentId" }, { status: 400 });
    }

    const canAccess = await canAccessWorkspace(user.id, workspaceId);
    if (!canAccess) {
      return NextResponse.json({ error: "Workspace not accessible" }, { status: 403 });
    }

    const commands = await listAgentCommands({ roomId: workspaceId, scopedAgentId, sessionId, limit });
    return NextResponse.json({ ok: true, commands });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Internal server error",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
