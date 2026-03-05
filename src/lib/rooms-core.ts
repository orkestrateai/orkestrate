import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { members, rooms } from "@/db/schema";

const ROOM_NAME_MAX = 80;

type RoomRole = "owner" | "admin" | "member";

export type RoomSummary = {
  id: string;
  name: string;
  repoUrl: string | null;
  role: RoomRole;
  isActive: boolean;
  updatedAt: Date;
};

function normalizeRoomName(name?: string, fallback = "Untitled Room") {
  const trimmed = (name || "").trim().replace(/\s+/g, " ");
  if (!trimmed) return fallback;
  return trimmed.slice(0, ROOM_NAME_MAX);
}

function normalizeMembershipRole(role: string | null | undefined): RoomRole {
  if (role === "owner" || role === "admin" || role === "member") return role;
  return "member";
}

function canManageRoom(role: RoomRole) {
  return role === "owner" || role === "admin";
}

function generateRoomId() {
  return `room_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

function generateMemberId() {
  return `mem_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

async function getFallbackMembershipRoomId(userId: string, excludedRoomId?: string | null) {
  const membership = await db.query.members.findFirst({
    where: excludedRoomId
      ? and(eq(members.userId, userId), ne(members.roomId, excludedRoomId))
      : eq(members.userId, userId),
    orderBy: (table, { desc, asc }) => [desc(table.updatedAt), asc(table.roomId)],
  });

  return membership?.roomId ?? null;
}

export async function listRoomsForUser(userId: string): Promise<RoomSummary[]> {
  const memberships = await db
    .select({
      id: rooms.id,
      name: rooms.name,
      repoUrl: rooms.repoUrl,
      updatedAt: rooms.updatedAt,
      role: members.role,
      isActive: members.isActive,
    })
    .from(members)
    .innerJoin(rooms, eq(members.roomId, rooms.id))
    .where(eq(members.userId, userId))
    .orderBy(desc(rooms.updatedAt), asc(rooms.id));

  if (!memberships.some((m) => m.isActive) && memberships.length > 0) {
    await setActiveRoomForUser(userId, memberships[0].id);
    return memberships.map((membership, i) => ({
      id: membership.id,
      name: membership.name,
      repoUrl: membership.repoUrl,
      role: normalizeMembershipRole(membership.role),
      isActive: i === 0,
      updatedAt: membership.updatedAt,
    }));
  }

  return memberships.map((membership) => ({
    id: membership.id,
    name: membership.name,
    repoUrl: membership.repoUrl,
    role: normalizeMembershipRole(membership.role),
    isActive: membership.isActive,
    updatedAt: membership.updatedAt,
  }));
}

export async function getRoomMembershipForUser(userId: string, roomId: string) {
  return db.query.members.findFirst({
    where: and(eq(members.userId, userId), eq(members.roomId, roomId)),
  });
}

export async function canAccessRoom(userId: string, roomId: string) {
  const membership = await getRoomMembershipForUser(userId, roomId);
  return Boolean(membership);
}

export async function setActiveRoomForUser(userId: string, roomId: string) {
  const membership = await getRoomMembershipForUser(userId, roomId);
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
      .where(and(eq(members.userId, userId), eq(members.roomId, roomId)));
  });

  return true;
}

export async function getActiveRoomIdForUser(userId: string) {
  const active = await db.query.members.findFirst({
    where: and(eq(members.userId, userId), eq(members.isActive, true)),
    orderBy: [desc(members.updatedAt)],
  });
  return active?.roomId ?? null;
}

export async function resolveReadableRoomIdForUser(
  userId: string,
  requestedRoomId?: string | null,
): Promise<{ roomId: string | null; requestedWasAccessible: boolean }> {
  if (requestedRoomId) {
    const ok = await canAccessRoom(userId, requestedRoomId);
    if (ok) return { roomId: requestedRoomId, requestedWasAccessible: true };
    return { roomId: null, requestedWasAccessible: false };
  }

  return { roomId: await getActiveRoomIdForUser(userId), requestedWasAccessible: true };
}

export async function createRoomForUser(userId: string, name?: string) {
  const now = new Date();
  const id = generateRoomId();
  const fallbackName = `Room ${id.slice(-4)}`;
  const resolvedName = normalizeRoomName(name, fallbackName);

  await db.transaction(async (tx) => {
    await tx.insert(rooms).values({
      id,
      name: resolvedName,
      ownerUserId: userId,
      createdAt: now,
      updatedAt: now,
    });

    await tx
      .update(members)
      .set({ isActive: false, updatedAt: now })
      .where(eq(members.userId, userId));

    await tx.insert(members).values({
      id: generateMemberId(),
      roomId: id,
      userId,
      role: "owner",
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  });

  return { id, name: resolvedName };
}

export async function renameRoomForUser(userId: string, roomId: string, name: string) {
  const membership = await getRoomMembershipForUser(userId, roomId);
  if (!membership) return false;

  const role = normalizeMembershipRole(membership.role);
  if (!canManageRoom(role)) return false;

  const trimmed = normalizeRoomName(name, "");
  if (!trimmed) return false;

  await db
    .update(rooms)
    .set({ name: trimmed, updatedAt: new Date() })
    .where(eq(rooms.id, roomId));

  return true;
}

export async function bindRepoToRoomForUser(userId: string, roomId: string, repoUrl: string | null) {
  const membership = await getRoomMembershipForUser(userId, roomId);
  if (!membership) return false;

  const role = normalizeMembershipRole(membership.role);
  if (!canManageRoom(role)) return false;

  await db
    .update(rooms)
    .set({ repoUrl, updatedAt: new Date() })
    .where(eq(rooms.id, roomId));

  return true;
}

export async function ensureActiveRoomForUser(userId: string) {
  const activeRoomId = await getActiveRoomIdForUser(userId);
  if (activeRoomId) return activeRoomId;

  const fallbackRoomId = await getFallbackMembershipRoomId(userId);
  if (fallbackRoomId) {
    await setActiveRoomForUser(userId, fallbackRoomId);
    return fallbackRoomId;
  }

  const created = await createRoomForUser(userId);
  return created.id;
}

export async function deleteRoomForUser(userId: string, roomId: string) {
  const membership = await getRoomMembershipForUser(userId, roomId);
  if (!membership) return false;

  const role = normalizeMembershipRole(membership.role);
  if (role === "owner") {
    const countRows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(members)
      .where(eq(members.roomId, roomId));

    const memberCount = Number(countRows[0]?.count || 0);
    if (memberCount > 1) return false;
  }

  const activeBeforeDelete = await getActiveRoomIdForUser(userId);
  if (activeBeforeDelete === roomId) {
    const fallbackRoomId = await getFallbackMembershipRoomId(userId, roomId);
    if (fallbackRoomId) {
      await setActiveRoomForUser(userId, fallbackRoomId);
    } else {
      await createRoomForUser(userId);
    }
  }

  if (role === "owner") {
    await db.delete(rooms).where(eq(rooms.id, roomId));
  } else {
    await db
      .delete(members)
      .where(and(eq(members.userId, userId), eq(members.roomId, roomId)));
  }

  return true;
}

