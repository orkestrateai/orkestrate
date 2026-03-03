import { createHash } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { agentActivity, agentStates } from "@/db/schema";

const CONFLICT_LOOKBACK_MS = 90 * 1000;

export type ActivityEventType =
  | "file_edit_observed"
  | "commit_observed"
  | "conflict_alert";

export type FileEditPayload = {
  path: string;
  operation: "create" | "update" | "delete" | "move" | "unknown";
  lineStart?: number;
  lineEnd?: number;
  snippet?: string;
  patchHash?: string;
};

export type CommitPayload = {
  sha: string;
  message: string;
  changedPaths: string[];
};

export function normalizePathLike(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const value = input.trim();
  if (!value) return null;
  return value
    .replace(/\\/g, "/")
    .replace(/\/{2,}/g, "/")
    .replace(/^\.\//, "")
    .replace(/\/+$/, "")
    .toLowerCase();
}

export function computePatchHash(input: unknown): string {
  const raw = typeof input === "string" ? input : JSON.stringify(input ?? {});
  return createHash("sha1").update(raw).digest("hex").slice(0, 16);
}

export async function recordAgentActivity(input: {
  workspaceId: string;
  scopedAgentId: string;
  agentId?: string | null;
  sessionId?: string | null;
  eventType: ActivityEventType;
  repo?: Record<string, unknown>;
  payload: Record<string, unknown>;
}) {
  const [row] = await db
    .insert(agentActivity)
    .values({
      workspaceId: input.workspaceId,
      scopedAgentId: input.scopedAgentId,
      agentId: input.agentId || null,
      sessionId: input.sessionId ?? null,
      eventType: input.eventType,
      repo: input.repo ?? {},
      payload: input.payload,
      createdAt: new Date(),
    })
    .returning();
  return row;
}

function extractClaimedPaths(stateContent: unknown): string[] {
  if (!stateContent || typeof stateContent !== "object") return [];
  const data = stateContent as Record<string, unknown>;

  const rawClaims = Array.isArray(data.claimedPaths)
    ? data.claimedPaths
    : Array.isArray(data.architectureFootprint)
      ? data.architectureFootprint
      : [];

  return rawClaims
    .map((p) => normalizePathLike(p))
    .filter((p): p is string => Boolean(p));
}

function toClaimPrefix(pathLike: string): string {
  const trimmed = pathLike.trim();
  if (trimmed.includes("*")) return trimmed.split("*")[0].replace(/\/+$/, "");
  return trimmed;
}

function pathsOverlap(claimPathRaw: string, editPathRaw: string): boolean {
  const claimPath = toClaimPrefix(claimPathRaw);
  const editPath = editPathRaw.replace(/\/+$/, "");
  if (!claimPath || !editPath) return false;
  return (
    editPath === claimPath ||
    editPath.startsWith(`${claimPath}/`) ||
    claimPath.startsWith(`${editPath}/`)
  );
}

export async function detectClaimConflictsForEdit(input: {
  workspaceId: string;
  scopedAgentId: string;
  editPath: string;
}) {
  const normalizedPath = normalizePathLike(input.editPath);
  if (!normalizedPath) return [];

  const states = await db.query.agentStates.findMany({
    where: eq(agentStates.projectId, input.workspaceId),
    orderBy: (table, { desc: descFn }) => [descFn(table.lastPingAt)],
  });

  const cutoff = Date.now() - CONFLICT_LOOKBACK_MS;
  const conflicts: Array<{
    conflictingScopedAgentId: string;
    claimPath: string;
  }> = [];

  for (const state of states) {
    const stateClientId = (state.scopedAgentId || "").toLowerCase();
    if (!stateClientId) continue;
    if (stateClientId === input.scopedAgentId.toLowerCase()) continue;
    if (new Date(state.lastPingAt).getTime() < cutoff) continue;

    const claims = extractClaimedPaths(state.stateContent);
    const matchingClaim = claims.find((claim) => pathsOverlap(claim, normalizedPath));
    if (!matchingClaim) continue;

    conflicts.push({
      conflictingScopedAgentId: state.scopedAgentId,
      claimPath: matchingClaim,
    });
  }

  return conflicts;
}

export async function recordConflictAlerts(input: {
  workspaceId: string;
  scopedAgentId: string;
  agentId?: string | null;
  sessionId?: string | null;
  editPath: string;
  conflicts: Array<{ conflictingScopedAgentId: string; claimPath: string }>;
  repo?: Record<string, unknown>;
}) {
  const writes = input.conflicts.map((conflict) =>
    recordAgentActivity({
      workspaceId: input.workspaceId,
      scopedAgentId: input.scopedAgentId,
      agentId: input.agentId,
      sessionId: input.sessionId ?? null,
      eventType: "conflict_alert",
      repo: input.repo,
      payload: {
        path: input.editPath,
        conflictingScopedAgentId: conflict.conflictingScopedAgentId,
        claimPath: conflict.claimPath,
      },
    }),
  );
  return Promise.all(writes);
}

export async function listRecentActivity(input: {
  workspaceId: string;
  limit?: number;
  scopedAgentId?: string;
}) {
  const limit = Math.max(1, Math.min(input.limit ?? 100, 500));
  return db.query.agentActivity.findMany({
    where: input.scopedAgentId
      ? and(
        eq(agentActivity.workspaceId, input.workspaceId),
        eq(agentActivity.scopedAgentId, input.scopedAgentId),
      )
      : eq(agentActivity.workspaceId, input.workspaceId),
    orderBy: (table, { desc: descFn }) => [descFn(table.createdAt)],
    limit,
  });
}
