import { randomUUID } from "node:crypto";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { projects, roomMemberships, rooms, userRoomPreferences } from "@/db/schema";

const WORKSPACE_NAME_MAX = 80;

function normalizeWorkspaceName(name?: string, fallback = "Untitled Workspace") {
  const trimmed = (name || "").trim().replace(/\s+/g, " ");
  if (!trimmed) return fallback;
  return trimmed.slice(0, WORKSPACE_NAME_MAX);
}

function generateWorkspaceId() {
  return `ws_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

async function clearActiveWorkspacePreference(userId: string) {
  await db.delete(userRoomPreferences).where(eq(userRoomPreferences.userId, userId));
}

export async function listWorkspacesForUser(userId: string) {
  const memberships = await db
    .select({
      id: rooms.id,
      name: rooms.name,
      updatedAt: rooms.updatedAt,
      role: roomMemberships.role,
    })
    .from(roomMemberships)
    .innerJoin(rooms, eq(roomMemberships.roomId, rooms.id))
    .where(eq(roomMemberships.userId, userId))
    .orderBy(desc(rooms.updatedAt), asc(rooms.id));

  const preference = await db.query.userRoomPreferences.findFirst({
    where: eq(userRoomPreferences.userId, userId),
  });

  let activeId: string | null = null;
  if (preference?.activeRoomId && memberships.some((m) => m.id === preference.activeRoomId)) {
    activeId = preference.activeRoomId;
  } else if (preference?.activeRoomId) {
    await clearActiveWorkspacePreference(userId);
  }

  if (!activeId && memberships.length > 0) {
    activeId = memberships[0].id;
    await setActiveWorkspaceForUser(userId, activeId);
  }

  // Enrich with counts for projects and active tasks
  const enriched = await Promise.all(memberships.map(async (workspace) => {
    const projectCount = await db
      .select({ count: db.$count(projects) })
      .from(projects)
      .where(eq(projects.roomId, workspace.id));

    // For now, "active tasks" means status != 'completed' and status != 'archived'
    // But since we just added the table, it might be 0.

    return {
      ...workspace,
      isActive: workspace.id === activeId,
      projectCount: projectCount[0]?.count || 0,
      activeTaskCount: 0, // Placeholder until we have tasks logic
    };
  }));

  return enriched;
}

export async function getWorkspaceMembershipForUser(userId: string, workspaceId: string) {
  return db.query.roomMemberships.findFirst({
    where: and(eq(roomMemberships.userId, userId), eq(roomMemberships.roomId, workspaceId)),
  });
}

export async function canAccessWorkspace(userId: string, workspaceId: string) {
  const membership = await getWorkspaceMembershipForUser(userId, workspaceId);
  return Boolean(membership);
}

export async function setActiveWorkspaceForUser(userId: string, workspaceId: string) {
  const membership = await getWorkspaceMembershipForUser(userId, workspaceId);
  if (!membership) return false;

  await db.insert(userRoomPreferences).values({
    userId,
    activeRoomId: workspaceId,
    updatedAt: new Date(),
  }).onConflictDoUpdate({
    target: [userRoomPreferences.userId],
    set: { activeRoomId: workspaceId, updatedAt: new Date() },
  });

  return true;
}

export async function getActiveWorkspaceIdForUser(userId: string) {
  const preference = await db.query.userRoomPreferences.findFirst({
    where: eq(userRoomPreferences.userId, userId),
  });

  if (!preference?.activeRoomId) return null;

  const membership = await db.query.roomMemberships.findFirst({
    where: and(eq(roomMemberships.userId, userId), eq(roomMemberships.roomId, preference.activeRoomId)),
  });

  if (!membership) {
    await clearActiveWorkspacePreference(userId);
    return null;
  }

  return preference.activeRoomId;
}

export async function resolveReadableWorkspaceIdForUser(
  userId: string,
  requestedWorkspaceId?: string | null,
): Promise<{ workspaceId: string | null; requestedWasAccessible: boolean }> {
  if (requestedWorkspaceId) {
    const ok = await canAccessWorkspace(userId, requestedWorkspaceId);
    if (ok) return { workspaceId: requestedWorkspaceId, requestedWasAccessible: true };
    return { workspaceId: null, requestedWasAccessible: false };
  }
  return { workspaceId: await getActiveWorkspaceIdForUser(userId), requestedWasAccessible: true };
}

export async function createWorkspaceForUser(userId: string, name?: string) {
  const now = new Date();
  const id = generateWorkspaceId();
  const fallbackName = `Workspace ${id.slice(-4)}`;
  const resolvedName = normalizeWorkspaceName(name, fallbackName);

  await db.transaction(async (tx) => {
    await tx.insert(rooms).values({
      id,
      name: resolvedName,
      ownerUserId: userId,
      createdAt: now,
      updatedAt: now,
    });

    await tx.insert(roomMemberships).values({
      roomId: id,
      userId,
      role: "owner",
      createdAt: now,
    }).onConflictDoNothing();

    await tx.insert(userRoomPreferences).values({
      userId,
      activeRoomId: id,
      updatedAt: now,
    }).onConflictDoUpdate({
      target: [userRoomPreferences.userId],
      set: { activeRoomId: id, updatedAt: now },
    });
  });

  return { id, name: resolvedName };
}

export async function renameWorkspaceForUser(userId: string, workspaceId: string, name: string) {
  const membership = await getWorkspaceMembershipForUser(userId, workspaceId);
  if (!membership) return false;

  const trimmed = normalizeWorkspaceName(name, "");
  if (!trimmed) return false;

  await db
    .update(rooms)
    .set({ name: trimmed, updatedAt: new Date() })
    .where(eq(rooms.id, workspaceId));

  return true;
}

export async function ensureActiveWorkspaceForUser(userId: string) {
  const activeWorkspaceId = await getActiveWorkspaceIdForUser(userId);
  if (activeWorkspaceId) return activeWorkspaceId;

  const created = await createWorkspaceForUser(userId);
  return created.id;
}

export async function deleteWorkspaceForUser(userId: string, workspaceId: string) {
  const activeBeforeDelete = await getActiveWorkspaceIdForUser(userId);
  if (activeBeforeDelete === workspaceId) return false;

  const membership = await getWorkspaceMembershipForUser(userId, workspaceId);
  if (!membership) return false;

  await db.delete(roomMemberships).where(and(eq(roomMemberships.userId, userId), eq(roomMemberships.roomId, workspaceId)));

  const remainingMembers = await db.query.roomMemberships.findFirst({
    where: eq(roomMemberships.roomId, workspaceId),
  });

  if (!remainingMembers) {
    await db.delete(rooms).where(eq(rooms.id, workspaceId));
  }

  return true;
}

