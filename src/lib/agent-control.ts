import { and, asc, desc, eq, inArray, isNull, lt, or } from "drizzle-orm";
import { db } from "@/db";
import { agentCommands } from "@/db/schema";

const COMMAND_TTL_MS = 10 * 60 * 1000;
const ACTIVE_DELIVERY_STATUSES = ["queued", "pulled"] as const;

export async function enqueueAgentCommand(input: {
  roomId: string;
  scopedAgentId: string;
  sessionId?: string | null;
  text: string;
}) {
  const now = new Date();
  const [row] = await db
    .insert(agentCommands)
    .values({
      roomId: input.roomId,
      scopedAgentId: input.scopedAgentId,
      sessionId: input.sessionId ?? null,
      text: input.text,
      status: "queued",
      createdAt: now,
    })
    .returning();
  return row;
}

export async function dequeueAgentCommands(input: {
  roomId: string;
  scopedAgentId: string;
  sessionId?: string | null;
  limit?: number;
}) {
  const limit = Math.max(1, Math.min(input.limit ?? 10, 50));
  const cutoff = new Date(Date.now() - COMMAND_TTL_MS);
  const now = new Date();

  await db
    .update(agentCommands)
    .set({ status: "expired", expiredAt: now })
    .where(
      and(
        lt(agentCommands.createdAt, cutoff),
        or(
          eq(agentCommands.status, ACTIVE_DELIVERY_STATUSES[0]),
          eq(agentCommands.status, ACTIVE_DELIVERY_STATUSES[1]),
        ),
      ),
    );

  return db.transaction(async (tx) => {
    const candidates = await tx
      .select()
      .from(agentCommands)
      .where(
        and(
          eq(agentCommands.roomId, input.roomId),
          eq(agentCommands.scopedAgentId, input.scopedAgentId),
          input.sessionId ? eq(agentCommands.sessionId, input.sessionId) : isNull(agentCommands.sessionId),
          eq(agentCommands.status, "queued"),
        ),
      )
      .orderBy(asc(agentCommands.createdAt))
      .limit(limit);

    if (candidates.length === 0) return [];

    const pulled = await tx
      .update(agentCommands)
      .set({ status: "pulled", pulledAt: now })
      .where(
        and(
          inArray(agentCommands.id, candidates.map((r) => r.id)),
          eq(agentCommands.status, "queued"),
        ),
      )
      .returning();

    return pulled;
  });
}

export async function acknowledgeAgentCommand(input: {
  id: string;
  roomId: string;
  scopedAgentId: string;
  status: "dispatched" | "failed";
  failureReason?: string | null;
}) {
  const now = new Date();
  const setData =
    input.status === "dispatched"
      ? {
        status: "dispatched" as const,
        dispatchedAt: now,
        failureReason: null,
      }
      : {
        status: "failed" as const,
        failedAt: now,
        failureReason: input.failureReason?.slice(0, 2000) || "Unknown dispatch failure",
      };

  const [row] = await db
    .update(agentCommands)
    .set(setData)
    .where(
      and(
        eq(agentCommands.id, input.id),
        eq(agentCommands.roomId, input.roomId),
        eq(agentCommands.scopedAgentId, input.scopedAgentId),
      ),
    )
    .returning();

  return row ?? null;
}

export async function listAgentCommands(input: {
  roomId: string;
  scopedAgentId: string;
  sessionId?: string | null;
  limit?: number;
}) {
  const limit = Math.max(1, Math.min(input.limit ?? 20, 100));
  return db
    .select()
    .from(agentCommands)
    .where(
      and(
        eq(agentCommands.roomId, input.roomId),
        eq(agentCommands.scopedAgentId, input.scopedAgentId),
        input.sessionId ? eq(agentCommands.sessionId, input.sessionId) : isNull(agentCommands.sessionId),
      ),
    )
    .orderBy(desc(agentCommands.createdAt))
    .limit(limit);
}
