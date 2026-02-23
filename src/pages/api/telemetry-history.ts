import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { desc, sql } from "drizzle-orm";
import { db } from "@/db";
import { agentTelemetry } from "@/db/schema";
import { json } from "@/lib/http";
import { getActiveRoomIdForUser, setActiveRoomForUser } from "@/lib/rooms";

const HISTORY_LIMIT = 5000;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "GET") {
      return json(res, 405, { error: "Method Not Allowed" });
    }

    const authHeader = req.headers.authorization;
    let userId: string | null = null;

    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) userId = user.id;
    }

    if (!userId) {
      return json(res, 401, { error: "Unauthorized" });
    }

    const roomIdFromQuery = typeof req.query.roomId === "string" ? req.query.roomId : null;
    if (roomIdFromQuery) {
      await setActiveRoomForUser(userId, roomIdFromQuery);
    }
    const roomId = roomIdFromQuery || await getActiveRoomIdForUser(userId);

    const sinceHours = Number(req.query.sinceHours ?? 24);
    const safeHours = Number.isFinite(sinceHours) ? Math.min(Math.max(sinceHours, 1), 168) : 24;
    const threshold = new Date(Date.now() - safeHours * 60 * 60 * 1000);

    const rows = await db
      .select({
        clientId: agentTelemetry.clientId,
        agent: agentTelemetry.agent,
        eventType: agentTelemetry.eventType,
        payload: agentTelemetry.payload,
        createdAt: agentTelemetry.createdAt,
      })
      .from(agentTelemetry)
      .where(sql`(${agentTelemetry.createdAt} >= ${threshold}) AND ((payload->>'roomId') = ${roomId} OR (${roomId} = 'default' AND (payload->>'roomId') IS NULL))`)
      .orderBy(desc(agentTelemetry.createdAt))
      .limit(HISTORY_LIMIT);

    const logs = rows
      .reverse()
      .map((row) => {
        const payload = (row.payload as any) || {};
        return {
          timestamp: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
          clientId: row.clientId,
          agent: row.agent,
          message: typeof payload.message === "string" ? payload.message : JSON.stringify(payload.message ?? payload),
          event: typeof payload.event === "string" ? payload.event : row.eventType || "log",
        };
      });

    return json(res, 200, { roomId, logs });
  } catch (error) {
    return json(res, 500, {
      error: "Internal server error",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}
