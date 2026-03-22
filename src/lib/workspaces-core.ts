import { randomUUID } from "node:crypto";
import { and, asc, count, desc, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { members, workspaces } from "@/db/schema";
import { getEffectiveLimitsForUser } from "@/lib/payments-core";

const WORKSPACE_NAME_MAX = 80;

type WorkspaceRole = "owner" | "admin" | "member";

export type WorkspaceSummary = {
  id: string;
  name: string;
  repoUrl: string | null;
  defaultBranch: string | null;
  baseBranch: string;
  role: WorkspaceRole;
  isActive: boolean;
  updatedAt: Date;
};

function normalizeWorkspaceName(
  name?: string,
  fallback = "Untitled Workspace",
) {
  const trimmed = (name || "").trim().replace(/\s+/g, " ");
  if (!trimmed) return fallback;
  return trimmed.slice(0, WORKSPACE_NAME_MAX);
}

function normalizeMembershipRole(
  role: string | null | undefined,
): WorkspaceRole {
  if (role === "owner" || role === "admin" || role === "member") return role;
  return "member";
}

function canManageWorkspace(role: WorkspaceRole) {
  return role === "owner" || role === "admin";
}

function generateWorkspaceId() {
  return `ws_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

function generateMemberId() {
  return `mem_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

async function getFallbackMembershipWorkspaceId(
  userId: string,
  excludedWorkspaceId?: string | null,
) {
  const membership = await db.query.members.findFirst({
    where: excludedWorkspaceId
      ? and(
          eq(members.userId, userId),
          ne(members.workspaceId, excludedWorkspaceId),
        )
      : eq(members.userId, userId),
    orderBy: (table, { desc, asc }) => [
      desc(table.updatedAt),
      asc(table.workspaceId),
    ],
  });

  return membership?.workspaceId ?? null;
}

export async function listWorkspacesForUser(
  userId: string,
): Promise<WorkspaceSummary[]> {
  const memberships = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      repoUrl: workspaces.repoUrl,
      defaultBranch: workspaces.defaultBranch,
      baseBranch: workspaces.baseBranch,
      updatedAt: workspaces.updatedAt,
      role: members.role,
      isActive: members.isActive,
    })
    .from(members)
    .innerJoin(workspaces, eq(members.workspaceId, workspaces.id))
    .where(eq(members.userId, userId))
    .orderBy(desc(workspaces.updatedAt), asc(workspaces.id));

  if (!memberships.some((m) => m.isActive) && memberships.length > 0) {
    await setActiveWorkspaceForUser(userId, memberships[0].id);
    return memberships.map((membership, i) => ({
      id: membership.id,
      name: membership.name,
      repoUrl: membership.repoUrl,
      defaultBranch: membership.defaultBranch ?? null,
      baseBranch: membership.baseBranch ?? "main",
      role: normalizeMembershipRole(membership.role),
      isActive: i === 0,
      updatedAt: membership.updatedAt,
    }));
  }

  return memberships.map((membership) => ({
    id: membership.id,
    name: membership.name,
    repoUrl: membership.repoUrl,
    defaultBranch: membership.defaultBranch ?? null,
    baseBranch: membership.baseBranch ?? "main",
    role: normalizeMembershipRole(membership.role),
    isActive: membership.isActive,
    updatedAt: membership.updatedAt,
  }));
}

export async function getWorkspaceMembershipForUser(
  userId: string,
  workspaceId: string,
) {
  return db.query.members.findFirst({
    where: and(
      eq(members.userId, userId),
      eq(members.workspaceId, workspaceId),
    ),
  });
}

export async function canAccessWorkspace(userId: string, workspaceId: string) {
  const membership = await getWorkspaceMembershipForUser(userId, workspaceId);
  return Boolean(membership);
}

export async function setActiveWorkspaceForUser(
  userId: string,
  workspaceId: string,
) {
  const membership = await getWorkspaceMembershipForUser(userId, workspaceId);
  if (!membership) return false;

  const now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(members)
      .set({ isActive: false, updatedAt: now })
      .where(eq(members.userId, userId));

    await tx
      .update(members)
      .set({ isActive: true, updatedAt: now })
      .where(
        and(eq(members.userId, userId), eq(members.workspaceId, workspaceId)),
      );
  });

  return true;
}

export async function getActiveWorkspaceIdForUser(userId: string) {
  const active = await db.query.members.findFirst({
    where: and(eq(members.userId, userId), eq(members.isActive, true)),
    orderBy: [desc(members.updatedAt)],
  });
  return active?.workspaceId ?? null;
}

export async function resolveReadableWorkspaceIdForUser(
  userId: string,
  requestedWorkspaceId?: string | null,
): Promise<{ workspaceId: string | null; requestedWasAccessible: boolean }> {
  if (requestedWorkspaceId) {
    const ok = await canAccessWorkspace(userId, requestedWorkspaceId);
    if (ok)
      return {
        workspaceId: requestedWorkspaceId,
        requestedWasAccessible: true,
      };
    return { workspaceId: null, requestedWasAccessible: false };
  }

  return {
    workspaceId: await getActiveWorkspaceIdForUser(userId),
    requestedWasAccessible: true,
  };
}

export async function createWorkspaceForUser(
  userId: string,
  name?: string,
  repoUrl?: string,
  baseBranch?: string,
): Promise<
  | {
      workspace: {
        id: string;
        name: string;
        repoUrl: string | null;
        defaultBranch: string | null;
        baseBranch: string;
      };
      error: null;
    }
  | { workspace: null; error: "limit_reached" | "unknown" }
> {
  // Check workspace limit against user's plan
  const limits = await getEffectiveLimitsForUser(userId);

  const [{ owned }] = await db
    .select({ owned: count() })
    .from(workspaces)
    .where(eq(workspaces.ownerUserId, userId));

  if (Number(owned) >= limits.maxWorkspaces) {
    return { workspace: null, error: "limit_reached" };
  }

  const now = new Date();
  const id = generateWorkspaceId();
  const fallbackName = `Workspace ${id.slice(-4)}`;
  const resolvedName = normalizeWorkspaceName(name, fallbackName);

  try {
    await db.transaction(async (tx) => {
      await tx.insert(workspaces).values({
        id,
        name: resolvedName,
        ownerUserId: userId,
        repoUrl: repoUrl || null,
        defaultBranch: repoUrl ? `orkestrate/${id}` : null,
        baseBranch: baseBranch ?? "main",
        maxAgents: limits.maxAgents,
        maxMembers: limits.maxMembers,
        createdAt: now,
        updatedAt: now,
      });

      await tx
        .update(members)
        .set({ isActive: false, updatedAt: now })
        .where(eq(members.userId, userId));

      await tx.insert(members).values({
        id: generateMemberId(),
        workspaceId: id,
        userId,
        role: "owner",
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
    });
  } catch {
    return { workspace: null, error: "unknown" };
  }

  return {
    workspace: {
      id,
      name: resolvedName,
      repoUrl: repoUrl || null,
      defaultBranch: repoUrl ? `orkestrate/${id}` : null,
      baseBranch: baseBranch ?? "main",
    },
    error: null,
  };
}

export async function renameWorkspaceForUser(
  userId: string,
  workspaceId: string,
  name: string,
) {
  const membership = await getWorkspaceMembershipForUser(userId, workspaceId);
  if (!membership) return false;

  const role = normalizeMembershipRole(membership.role);
  if (!canManageWorkspace(role)) return false;

  const trimmed = normalizeWorkspaceName(name, "");
  if (!trimmed) return false;

  await db
    .update(workspaces)
    .set({ name: trimmed, updatedAt: new Date() })
    .where(eq(workspaces.id, workspaceId));

  return true;
}

export async function bindRepoToWorkspaceForUser(
  userId: string,
  workspaceId: string,
  repoUrl: string | null,
  baseBranch?: string,
) {
  const membership = await getWorkspaceMembershipForUser(userId, workspaceId);
  if (!membership) return false;

  const role = normalizeMembershipRole(membership.role);
  if (!canManageWorkspace(role)) return false;

  await db
    .update(workspaces)
    .set({
      repoUrl,
      defaultBranch: repoUrl ? `orkestrate/${workspaceId}` : null,
      baseBranch: baseBranch ?? "main",
      updatedAt: new Date(),
    })
    .where(eq(workspaces.id, workspaceId));

  return true;
}

export async function ensureActiveWorkspaceForUser(userId: string) {
  // Only return the explicitly active workspace. Do not auto-select a fallback.
  return await getActiveWorkspaceIdForUser(userId);
}

export async function deleteWorkspaceForUser(
  userId: string,
  workspaceId: string,
) {
  const membership = await getWorkspaceMembershipForUser(userId, workspaceId);
  if (!membership) return false;

  const role = normalizeMembershipRole(membership.role);
  if (role === "owner") {
    const countRows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(members)
      .where(eq(members.workspaceId, workspaceId));

    const memberCount = Number(countRows[0]?.count || 0);
    if (memberCount > 1) return false;
  }

  const activeBeforeDelete = await getActiveWorkspaceIdForUser(userId);
  if (activeBeforeDelete === workspaceId) {
    const fallbackWorkspaceId = await getFallbackMembershipWorkspaceId(
      userId,
      workspaceId,
    );
    if (fallbackWorkspaceId) {
      await setActiveWorkspaceForUser(userId, fallbackWorkspaceId);
    }
  }

  if (role === "owner") {
    await db.delete(workspaces).where(eq(workspaces.id, workspaceId));
  } else {
    await db
      .delete(members)
      .where(
        and(eq(members.userId, userId), eq(members.workspaceId, workspaceId)),
      );
  }

  return true;
}
