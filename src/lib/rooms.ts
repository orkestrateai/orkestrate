import { randomUUID } from "node:crypto";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { roomMemberships, rooms, userRoomPreferences } from "@/db/schema";

async function clearActiveRoomPreference(userId: string) {
  await db.delete(userRoomPreferences).where(eq(userRoomPreferences.userId, userId));
}

export async function listRoomsForUser(userId: string) {
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
    await clearActiveRoomPreference(userId);
  }

  return memberships.map((room) => ({
    ...room,
    isActive: room.id === activeId,
  }));
}

export async function setActiveRoomForUser(userId: string, roomId: string) {
  const membership = await getRoomMembershipForUser(userId, roomId);
  if (!membership) return false;

  await db.insert(userRoomPreferences).values({
    userId,
    activeRoomId: roomId,
    updatedAt: new Date(),
  }).onConflictDoUpdate({
    target: [userRoomPreferences.userId],
    set: { activeRoomId: roomId, updatedAt: new Date() },
  });

  return true;
}

export async function getActiveRoomIdForUser(userId: string) {
  const preference = await db.query.userRoomPreferences.findFirst({
    where: eq(userRoomPreferences.userId, userId),
  });

  if (!preference?.activeRoomId) return null;

  const membership = await db.query.roomMemberships.findFirst({
    where: and(eq(roomMemberships.userId, userId), eq(roomMemberships.roomId, preference.activeRoomId)),
  });

  if (!membership) {
    await clearActiveRoomPreference(userId);
    return null;
  }

  return preference.activeRoomId;
}

export async function getRoomMembershipForUser(userId: string, roomId: string) {
  return db.query.roomMemberships.findFirst({
    where: and(eq(roomMemberships.userId, userId), eq(roomMemberships.roomId, roomId)),
  });
}

export async function canAccessRoom(userId: string, roomId: string) {
  const membership = await getRoomMembershipForUser(userId, roomId);
  return Boolean(membership);
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
  const id = `room_${randomUUID().split("-")[0]}`;
  const now = new Date();
  const resolvedName = name?.trim() || `Room ${id.slice(-4)}`;

  await db.insert(rooms).values({
    id,
    name: resolvedName,
    ownerUserId: userId,
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(roomMemberships).values({
    roomId: id,
    userId,
    role: "owner",
    createdAt: now,
  }).onConflictDoNothing();

  await setActiveRoomForUser(userId, id);
  return { id, name: resolvedName };
}

export async function ensureActiveRoomForUser(userId: string) {
  const activeRoomId = await getActiveRoomIdForUser(userId);
  if (activeRoomId) return activeRoomId;

  const created = await createRoomForUser(userId);
  return created.id;
}

export async function deleteRoomForUser(userId: string, roomId: string) {
  const activeBeforeDelete = await getActiveRoomIdForUser(userId);
  const wasActive = activeBeforeDelete === roomId;

  const membership = await getRoomMembershipForUser(userId, roomId);
  if (!membership) return false;

  await db.delete(roomMemberships).where(and(eq(roomMemberships.userId, userId), eq(roomMemberships.roomId, roomId)));

  if (wasActive) {
    const remainingRooms = await listRoomsForUser(userId);
    if (remainingRooms.length > 0) {
      await setActiveRoomForUser(userId, remainingRooms[0].id);
    } else {
      await clearActiveRoomPreference(userId);
    }
  }

  const remainingMembers = await db.query.roomMemberships.findFirst({
    where: eq(roomMemberships.roomId, roomId),
  });

  if (!remainingMembers) {
    await db.delete(rooms).where(eq(rooms.id, roomId));
  }

  return true;
}
