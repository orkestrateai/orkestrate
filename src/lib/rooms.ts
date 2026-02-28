// Backward-compatibility adapter.
// Canonical domain module is now `@/lib/workspaces`.
export {
  listWorkspacesForUser as listRoomsForUser,
  setActiveWorkspaceForUser as setActiveRoomForUser,
  getActiveWorkspaceIdForUser as getActiveRoomIdForUser,
  getWorkspaceMembershipForUser as getRoomMembershipForUser,
  canAccessWorkspace as canAccessRoom,
  createWorkspaceForUser as createRoomForUser,
  renameWorkspaceForUser as renameRoomForUser,
  ensureActiveWorkspaceForUser as ensureActiveRoomForUser,
  deleteWorkspaceForUser as deleteRoomForUser,
} from "@/lib/workspaces";

import { resolveReadableWorkspaceIdForUser } from "@/lib/workspaces";

export async function resolveReadableRoomIdForUser(
  userId: string,
  requestedRoomId?: string | null,
): Promise<{ roomId: string | null; requestedWasAccessible: boolean }> {
  const result = await resolveReadableWorkspaceIdForUser(userId, requestedRoomId);
  return { roomId: result.workspaceId, requestedWasAccessible: result.requestedWasAccessible };
}

