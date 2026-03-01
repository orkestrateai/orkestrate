import { NextRequest, NextResponse } from "next/server";
import { normalizeTelemetryScopedClientId } from "@/lib/agent-identity";
import { acknowledgeAgentCommand } from "@/lib/agent-control";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("clientId") || "";
    const agent = searchParams.get("agent") || "";
    const workspaceId = (searchParams.get("workspaceId") || searchParams.get("roomId")) || "";

    if (!clientId || !agent || !workspaceId) {
      return NextResponse.json({ error: "Missing clientId, agent, or workspaceId" }, { status: 400 });
    }

    const body = await req.json();
    const commandId = typeof body?.commandId === "string" ? body.commandId : "";
    const status = body?.status === "dispatched" || body?.status === "failed" ? body.status : null;
    const failureReason = typeof body?.failureReason === "string" ? body.failureReason : null;

    if (!commandId || !status) {
      return NextResponse.json({ error: "Missing commandId or status" }, { status: 400 });
    }

    const scopedAgentId = normalizeTelemetryScopedClientId(clientId, agent);
    const updated = await acknowledgeAgentCommand({
      id: commandId,
      roomId: workspaceId,
      scopedAgentId,
      status,
      failureReason,
    });

    if (!updated) {
      return NextResponse.json({ error: "Command not found for agent/workspace" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, command: updated });
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
