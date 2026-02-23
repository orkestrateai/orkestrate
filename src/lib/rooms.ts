import { randomUUID } from "node:crypto";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { roomMemberships, rooms, userRoomPreferences } from "@/db/schema";

export async function ensureDefaultRoomForUser(userId: string) {
  const existingMembership = await db.query.roomMemberships.findFirst({
    where: and(eq(roomMemberships.userId, userId), eq(roomMemberships.roomId, "default")),
  });

  if (!existingMembership) {
    await db.insert(rooms).values({
      id: "default",
      name: "Default",
      ownerUserId: userId,
      updatedAt: new Date(),
    }).onConflictDoNothing();

    await db.insert(roomMemberships).values({
      roomId: "default",
      userId,
      role: "owner",
    }).onConflictDoNothing();
  }

  const preference = await db.query.userRoomPreferences.findFirst({
    where: eq(userRoomPreferences.userId, userId),
  });

  if (!preference) {
    await db.insert(userRoomPreferences).values({
      userId,
      activeRoomId: "default",
      updatedAt: new Date(),
    }).onConflictDoNothing();
  }
}

export async function listRoomsForUser(userId: string) {
  await ensureDefaultRoomForUser(userId);

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

  const preferredId = preference?.activeRoomId;
  const fallbackId = memberships[0]?.id || null;
  const activeId = preferredId && memberships.some((m) => m.id === preferredId) ? preferredId : fallbackId;

  if (activeId && activeId !== preferredId) {
    await db.insert(userRoomPreferences).values({
      userId,
      activeRoomId: activeId,
      updatedAt: new Date(),
    }).onConflictDoUpdate({
      target: [userRoomPreferences.userId],
      set: { activeRoomId: activeId, updatedAt: new Date() },
    });
  }

  return memberships.map((room) => ({
    ...room,
    isActive: room.id === activeId,
  }));
}

export async function setActiveRoomForUser(userId: string, roomId: string) {
  const membership = await db.query.roomMemberships.findFirst({
    where: and(eq(roomMemberships.userId, userId), eq(roomMemberships.roomId, roomId)),
  });
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
  const roomsForUser = await listRoomsForUser(userId);
  const active = roomsForUser.find((r) => r.isActive);
  return active?.id || "default";
}

export async function createRoomForUser(userId: string, name?: string) {
  const id = `room_${randomUUID().split("-")[0]}`;
  const now = new Date();

  await db.insert(rooms).values({
    id,
    name: name?.trim() || `Room ${id.slice(-4)}`,
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
  return { id };
}

export async function deleteRoomForUser(userId: string, roomId: string) {
  if (roomId === "default") return false;

  const membership = await db.query.roomMemberships.findFirst({
    where: and(eq(roomMemberships.userId, userId), eq(roomMemberships.roomId, roomId)),
  });
  if (!membership) return false;

  await db.delete(roomMemberships).where(and(eq(roomMemberships.userId, userId), eq(roomMemberships.roomId, roomId)));

  const remainingMembers = await db.query.roomMemberships.findFirst({
    where: eq(roomMemberships.roomId, roomId),
  });

  if (!remainingMembers) {
    await db.delete(rooms).where(eq(rooms.id, roomId));
  }

  const currentActive = await getActiveRoomIdForUser(userId);
  if (currentActive === roomId) {
    await setActiveRoomForUser(userId, "default");
  }

  return true;
}
