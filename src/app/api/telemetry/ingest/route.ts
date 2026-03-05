import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { agents, agentSessions } from "@/db/schema";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

export const runtime = "nodejs";
const MAX_TRANSCRIPT = 400;

function cors() {
  return {
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-orkestrate-ts, x-orkestrate-signature",
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: cors() });
}

export async function POST(req: NextRequest) {
  // 1. Parse body
  const raw = await req.text().catch(() => "");
  let body: any;
  try { body = raw ? JSON.parse(raw) : {}; } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400, headers: cors() });
  }

  // Temporary shutdown: ignore OpenCode plugin telemetry envelopes.
  if (body?.source === "opencode-plugin") {
    return NextResponse.json({
      ok: true,
      accepted: false,
      reason: "OpenCode plugin telemetry is temporarily disabled",
    }, { headers: cors() });
  }

  // 2. Verify signature (if configured)
  const secret = process.env.ORKESTRATE_PLUGIN_SIGNING_SECRET || "";
  if (secret) {
    const ts = req.headers.get("x-orkestrate-ts") || "";
    const sig = req.headers.get("x-orkestrate-signature") || "";
    if (!ts || !sig) return NextResponse.json({ ok: false, error: "Missing signature" }, { status: 401, headers: cors() });

    const age = Math.abs(Date.now() - Date.parse(ts));
    if (!Number.isFinite(age) || age > 5 * 60 * 1000)
      return NextResponse.json({ ok: false, error: "Stale timestamp" }, { status: 401, headers: cors() });

    const expected = createHmac("sha256", secret).update(raw).digest("hex");
    const ok = sig.length === expected.length && timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
    if (!ok) return NextResponse.json({ ok: false, error: "Bad signature" }, { status: 401, headers: cors() });
  }

  // 3. Find agent
  const agentId = typeof body.agentId === "string" ? body.agentId.trim() : "";
  if (!agentId) return NextResponse.json({ ok: false, error: "Missing agentId" }, { status: 400, headers: cors() });

  const agent = await db.query.agents.findFirst({ where: eq(agents.id, agentId) })
    || await db.query.agents.findFirst({ where: eq(agents.label, agentId), orderBy: [desc(agents.updatedAt)] });

  if (!agent) return NextResponse.json({ ok: true, accepted: false, reason: "Agent not registered" }, { headers: cors() });

  const kind = typeof body.kind === "string" ? body.kind : "event";
  const now = new Date();
  const entry = {
    timestamp: now.toISOString(),
    type: kind,
    payload: body.payload ?? {},
    message: JSON.stringify({ type: kind, payload: body.payload ?? {} }),
  };
  const entryJson = JSON.stringify(entry);

  // 4/5/6 in one transaction:
  // - serialize updates per agent to avoid concurrent session creation races
  // - append transcript atomically in SQL to avoid read/modify/write lost updates
  const sessionId = await db.transaction(async (tx) => {
    await tx.update(agents).set({
      status: "active",
      disconnectedAt: null,
      lastMessageAt: now,
      pluginConnectedAt: now,
      updatedAt: now,
    }).where(eq(agents.id, agent.id));

    let session = await tx.query.agentSessions.findFirst({
      where: and(eq(agentSessions.agentId, agent.id), eq(agentSessions.status, "active")),
      orderBy: [desc(agentSessions.startedAt)],
    });

    if (!session) {
      const id = `sess_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
      await tx.insert(agentSessions).values({
        id,
        agentId: agent.id,
        roomId: agent.roomId,
        status: "active",
        startedAt: now,
        endedAt: null,
        lastMessageAt: now,
        transcript: [],
        transcriptUpdatedAt: null,
        createdAt: now,
        updatedAt: now,
      });
      session = await tx.query.agentSessions.findFirst({ where: eq(agentSessions.id, id) });
    }

    if (!session) throw new Error("Session creation failed");

    const transcriptValue = kind === "connect"
      ? [entry]
      : sql`(
        SELECT COALESCE(jsonb_agg(trimmed.value ORDER BY trimmed.ord), '[]'::jsonb)
        FROM (
          SELECT arr.value, arr.ord
          FROM jsonb_array_elements(
            COALESCE(${agentSessions.transcript}, '[]'::jsonb) || jsonb_build_array(${entryJson}::jsonb)
          ) WITH ORDINALITY AS arr(value, ord)
          ORDER BY arr.ord DESC
          LIMIT ${MAX_TRANSCRIPT}
        ) AS trimmed
      )`;

    await tx.update(agentSessions).set({
      transcript: transcriptValue,
      transcriptUpdatedAt: now,
      lastMessageAt: now,
      updatedAt: now,
    }).where(eq(agentSessions.id, session.id));

    return session.id;
  }).catch((error) => {
    throw error;
  });

  return NextResponse.json({
    ok: true,
    accepted: true,
    agentId: agent.id,
    sessionId,
    kind,
  }, { headers: cors() });
}
