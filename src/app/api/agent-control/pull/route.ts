import { NextRequest, NextResponse } from "next/server";
import { dequeueAgentCommands } from "@/lib/agent-control";
import { normalizeTelemetryScopedClientId } from "@/lib/agent-identity";
import { db } from "@/db";
import { agentSessions } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("clientId") || "";
    const agent = searchParams.get("agent") || "";
    const roomId = searchParams.get("roomId") || "";
    let sessionId = searchParams.get("sessionId") || null;

    if (!clientId || !agent || !roomId) {
      return NextResponse.json({ error: "Missing clientId, agent, or roomId" }, { status: 400 });
    }

    const scopedAgentId = normalizeTelemetryScopedClientId(clientId, agent);

    // Resolution: If sessionId is an external string (e.g. "ses_..."), find its internal UUID
    if (sessionId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionId)) {
      const session = await db.query.agentSessions.findFirst({
        where: and(
          eq(agentSessions.roomId, roomId),
          eq(agentSessions.scopedAgentId, scopedAgentId),
          sql`${agentSessions.metadata}->>'externalSessionId' = ${sessionId}`
        )
      });
      sessionId = session?.id || null;

      // If we provided an external ID but found no session, we definitely shouldn't pull random commands.
      if (!sessionId) {
        return NextResponse.json({ ok: true, commands: [] });
      }
    }

    const commands = await dequeueAgentCommands({ roomId, scopedAgentId, sessionId, limit: 10 });
    return NextResponse.json({ ok: true, commands });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error", detail: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
