import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { workspaceCodebases } from "@/db/schema";

export type RepoSnapshot = {
  canonicalRemote?: string;
  branch?: string;
  headSha?: string;
  dirty?: boolean;
};

export type CodebaseMatchResult =
  | { status: "unknown" }
  | { status: "bound" | "matched"; canonicalRemote: string }
  | { status: "mismatch"; canonicalRemote: string; receivedRemote: string };

function normalizeHost(host: string): string {
  return host.trim().toLowerCase();
}

function normalizeRepoPath(path: string): string {
  return path
    .trim()
    .replace(/^\/+/, "")
    .replace(/\/+$/, "")
    .replace(/\.git$/i, "")
    .replace(/\/{2,}/g, "/");
}

export function normalizeCanonicalRemote(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const text = raw.trim();
  if (!text) return null;

  // ssh scp-like form: git@github.com:owner/repo.git
  const scpMatch = text.match(/^([^@]+)@([^:]+):(.+)$/);
  if (scpMatch) {
    const host = normalizeHost(scpMatch[2]);
    const repoPath = normalizeRepoPath(scpMatch[3]);
    return host && repoPath ? `${host}/${repoPath}` : null;
  }

  // URL forms: https://host/owner/repo(.git), ssh://git@host/owner/repo(.git)
  try {
    const parsed = new URL(text);
    const host = normalizeHost(parsed.hostname);
    const repoPath = normalizeRepoPath(parsed.pathname);
    if (!host || !repoPath) return null;
    return `${host}/${repoPath}`;
  } catch {
    // Fall through: accept already-normalized "host/owner/repo"
  }

  const fallback = text.replace(/^git@/i, "");
  const [hostPart, ...pathParts] = fallback.split("/");
  const host = normalizeHost(hostPart || "");
  const repoPath = normalizeRepoPath(pathParts.join("/"));
  if (!host || !repoPath) return null;
  return `${host}/${repoPath}`;
}

export function normalizeRepoSnapshot(input: unknown): RepoSnapshot {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {};
  }
  const repo = input as Record<string, unknown>;
  const canonicalRemote =
    normalizeCanonicalRemote(repo.canonicalRemote) ??
    normalizeCanonicalRemote(repo.remote) ??
    normalizeCanonicalRemote(repo.origin) ??
    undefined;

  const branch =
    typeof repo.branch === "string" && repo.branch.trim()
      ? repo.branch.trim()
      : undefined;

  const headSha =
    typeof repo.headSha === "string" && repo.headSha.trim()
      ? repo.headSha.trim()
      : undefined;

  const dirty = typeof repo.dirty === "boolean" ? repo.dirty : undefined;

  return { canonicalRemote, branch, headSha, dirty };
}

export async function getWorkspaceCanonicalRemote(
  workspaceId: string,
): Promise<string | null> {
  const row = await db.query.workspaceCodebases.findFirst({
    where: eq(workspaceCodebases.workspaceId, workspaceId),
  });
  return row?.canonicalRemote ?? null;
}

export async function ensureWorkspaceCodebaseMatch(input: {
  workspaceId: string;
  userId: string;
  canonicalRemote: string | null;
  defaultBranch?: string | null;
}): Promise<CodebaseMatchResult> {
  const normalized = normalizeCanonicalRemote(input.canonicalRemote);
  if (!normalized) return { status: "unknown" };

  const existing = await db.query.workspaceCodebases.findFirst({
    where: eq(workspaceCodebases.workspaceId, input.workspaceId),
  });

  if (!existing) {
    await db
      .insert(workspaceCodebases)
      .values({
        workspaceId: input.workspaceId,
        canonicalRemote: normalized,
        defaultBranch:
          typeof input.defaultBranch === "string" && input.defaultBranch.trim()
            ? input.defaultBranch.trim()
            : null,
        createdBy: input.userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoNothing();

    const afterInsert = await db.query.workspaceCodebases.findFirst({
      where: eq(workspaceCodebases.workspaceId, input.workspaceId),
    });

    if (!afterInsert) {
      return { status: "unknown" };
    }

    if (afterInsert.canonicalRemote === normalized) {
      return { status: "bound", canonicalRemote: normalized };
    }

    return {
      status: "mismatch",
      canonicalRemote: afterInsert.canonicalRemote,
      receivedRemote: normalized,
    };
  }

  if (existing.canonicalRemote !== normalized) {
    return {
      status: "mismatch",
      canonicalRemote: existing.canonicalRemote,
      receivedRemote: normalized,
    };
  }

  if (
    existing.defaultBranch == null &&
    typeof input.defaultBranch === "string" &&
    input.defaultBranch.trim()
  ) {
    await db
      .update(workspaceCodebases)
      .set({
        defaultBranch: input.defaultBranch.trim(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(workspaceCodebases.workspaceId, input.workspaceId),
          eq(workspaceCodebases.canonicalRemote, existing.canonicalRemote),
        ),
      );
  }

  return { status: "matched", canonicalRemote: existing.canonicalRemote };
}

export function getCodebaseMatchStatus(input: {
  workspaceCanonicalRemote: string | null;
  agentCanonicalRemote?: string | null;
}): "matched" | "mismatch" | "unknown" {
  const workspaceRemote = normalizeCanonicalRemote(input.workspaceCanonicalRemote);
  const agentRemote = normalizeCanonicalRemote(input.agentCanonicalRemote);
  if (!workspaceRemote || !agentRemote) return "unknown";
  return workspaceRemote === agentRemote ? "matched" : "mismatch";
}
