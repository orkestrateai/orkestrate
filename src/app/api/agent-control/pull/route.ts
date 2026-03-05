import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { pullAgentCommands, waitForAgentCommand } from "@/lib/agent-command-queue";
import { db } from "@/db";
import { agents } from "@/db/schema";

export const runtime = "nodejs";

function noStoreJson(payload: unknown, status = 200) {
  return NextResponse.json(payload, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(req: NextRequest) {
  try {
    const agentHint = (req.nextUrl.searchParams.get("agentId") || "").trim();
    if (!agentHint) return noStoreJson({ error: "Missing agentId" }, 400);
    const waitParam = req.nextUrl.searchParams.get("waitMs") || "0";
    const waitParsed = Number(waitParam);
    const waitMs = Number.isFinite(waitParsed)
      ? Math.min(25_000, Math.max(0, Math.floor(waitParsed)))
      : 0;

    const foundById = await db.query.agents.findFirst({ where: eq(agents.id, agentHint) });
    const foundByLabel = foundById
      ? null
      : await db.query.agents.findFirst({ where: eq(agents.label, agentHint), orderBy: [desc(agents.updatedAt)] });
    const agent = foundById || foundByLabel;
    if (!agent) return noStoreJson({ commands: [] });

    let commands = pullAgentCommands(agent.id, 5).map((cmd) => ({
      id: cmd.id,
      text: cmd.text,
      workspaceId: cmd.workspaceId,
      createdAt: cmd.createdAt,
    }));

    if (commands.length === 0 && waitMs > 0) {
      await waitForAgentCommand(agent.id, waitMs);
      commands = pullAgentCommands(agent.id, 5).map((cmd) => ({
        id: cmd.id,
        text: cmd.text,
        workspaceId: cmd.workspaceId,
        createdAt: cmd.createdAt,
      }));
    }

    return noStoreJson({ commands, agentId: agent.id });
  } catch (error) {
    return noStoreJson({ error: "Internal server error", detail: error instanceof Error ? error.message : String(error) }, 500);
  }
}
