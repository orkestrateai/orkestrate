import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { and, desc, eq, gte, inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { agentStates, agentTelemetry } from "@/db/schema";
import { json } from "@/lib/http";
import { resolveReadableWorkspaceIdForUser } from "@/lib/workspaces";
import { normalizeTelemetryScopedClientId, splitScopedClientId } from "@/lib/agent-identity";
import { listRecentActivity } from "@/lib/agent-activity";

const HISTORY_LIMIT = 5000;
// Event types to exclude from history results (noise)
const EXCLUDED_EVENT_TYPES = new Set(['heartbeat', 'connect', 'disconnect', 'ping', 'system']);

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

    const requestedId = (req.query.workspaceId || req.query.roomId) as string | undefined;
    const { workspaceId, requestedWasAccessible } = await resolveReadableWorkspaceIdForUser(userId, requestedId || null);

    if (requestedId && !requestedWasAccessible) {
      return json(res, 403, { error: "Workspace not accessible" });
    }
    if (!workspaceId) {
      return json(res, 200, { workspaceId: null, roomId: null, logs: [] });
    }

    const sinceHours = Number(req.query.sinceHours ?? 24);
    const safeHours = Number.isFinite(sinceHours) ? Math.min(Math.max(sinceHours, 1), 168) : 24;
    const threshold = new Date(Date.now() - safeHours * 60 * 60 * 1000);
    const includeActivity = String(req.query.includeActivity || "").toLowerCase() === "true";

    const knownClientRows = await db
      .select({ clientId: agentStates.clientId })
      .from(agentStates)
      .where(eq(agentStates.userId, userId));
    const knownScopedClientIds = Array.from(new Set(knownClientRows.map((r) => r.clientId).filter((v): v is string => Boolean(v))));
    const knownBaseClientIds = Array.from(new Set(
      knownScopedClientIds
        .map((clientId) => splitScopedClientId(clientId).clientBaseId)
        .filter((v): v is string => Boolean(v)),
    ));

    const legacyRoomFilter = sql`(payload->>'roomId') = ${workspaceId}`;

    const roomScope = or(
      eq(agentTelemetry.roomId, workspaceId),
      and(isNull(agentTelemetry.roomId), legacyRoomFilter),
    );

    const nullUserClauses = [];
    if (knownBaseClientIds.length > 0) {
      nullUserClauses.push(inArray(agentTelemetry.clientId, knownBaseClientIds));
    }
    if (knownScopedClientIds.length > 0) {
      nullUserClauses.push(inArray(agentTelemetry.clientId, knownScopedClientIds));
    }

    const userScope = nullUserClauses.length > 0
      ? or(
        eq(agentTelemetry.userId, userId),
        and(isNull(agentTelemetry.userId), or(...nullUserClauses)),
      )
      : eq(agentTelemetry.userId, userId);

    const rows = await db
      .select({
        clientId: agentTelemetry.clientId,
        agent: agentTelemetry.agent,
        eventType: agentTelemetry.eventType,
        payload: agentTelemetry.payload,
        createdAt: agentTelemetry.createdAt,
        sessionId: agentTelemetry.sessionId,
      })
      .from(agentTelemetry)
      .where(and(gte(agentTelemetry.createdAt, threshold), roomScope, userScope))
      .orderBy(desc(agentTelemetry.createdAt))
      .limit(HISTORY_LIMIT);

    const logs = rows
      .filter((row) => {
        // Server-side filtering of noisy events
        if (row.eventType && EXCLUDED_EVENT_TYPES.has(row.eventType)) return false;
        // Also check the payload message for legacy heartbeats
        const payload = (row.payload as any) || {};
        if (typeof payload.type === 'string' && EXCLUDED_EVENT_TYPES.has(payload.type)) return false;
        return true;
      })
      .reverse()
      .map((row) => {
        const payload = (row.payload as any) || {};
        const rawMessage = payload.message;
        let message = "";
        if (typeof rawMessage === "string") {
          message = rawMessage;
        } else if (rawMessage !== undefined) {
          try {
            message = JSON.stringify(rawMessage);
          } catch {
            message = String(rawMessage);
          }
        } else {
          try {
            message = JSON.stringify(payload);
          } catch {
            message = String(payload);
          }
        }
        return {
          timestamp: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
          clientId: row.clientId,
          agent: row.agent,
          scopedAgentId: normalizeTelemetryScopedClientId(row.clientId, row.agent),
          message,
          event: typeof payload.event === "string" ? payload.event : row.eventType || "log",
          sessionId: row.sessionId,
        };
      });

    const activity = includeActivity
      ? (await listRecentActivity({ workspaceId, limit: 200 }))
        .reverse()
        .map((event) => ({
          timestamp: event.createdAt instanceof Date ? event.createdAt.toISOString() : String(event.createdAt),
          clientId: splitScopedClientId(event.scopedAgentId).clientBaseId,
          agent: splitScopedClientId(event.scopedAgentId).scopedAgentId || event.scopedAgentId,
          scopedAgentId: event.scopedAgentId,
          message: JSON.stringify({
            type: event.eventType,
            payload: event.payload,
            repo: event.repo,
            workspaceId,
          }),
          event: "activity",
          sessionId: event.sessionId,
        }))
      : [];

    const mergedLogs = [...logs, ...activity].sort((a, b) => {
      const left = new Date(a.timestamp).getTime();
      const right = new Date(b.timestamp).getTime();
      return left - right;
    });

    return json(res, 200, { workspaceId, roomId: workspaceId, logs: mergedLogs });
  } catch (error) {
    return json(res, 500, {
      error: "Internal server error",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}
