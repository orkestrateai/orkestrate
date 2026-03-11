import {
  canAccessRoom,
  createRoomForUser,
  deleteRoomForUser,
  ensureActiveRoomForUser,
  getActiveRoomIdForUser,
  getRoomMembershipForUser,
  listRoomsForUser,
  renameRoomForUser,
  bindRepoToRoomForUser,
  resolveReadableRoomIdForUser,
  setActiveRoomForUser,
  type RoomSummary,
} from "@/lib/rooms-core";

export type WorkspaceSummary = RoomSummary;

export const listWorkspacesForUser = listRoomsForUser;
export const getWorkspaceMembershipForUser = getRoomMembershipForUser;
export const canAccessWorkspace = canAccessRoom;
export const setActiveWorkspaceForUser = setActiveRoomForUser;
export const getActiveWorkspaceIdForUser = getActiveRoomIdForUser;
export const resolveReadableWorkspaceIdForUser = resolveReadableRoomIdForUser;
export const createWorkspaceForUser = (
  userId: string,
  name?: string,
  repoUrl?: string,
  defaultBranch?: string
) => createRoomForUser(userId, name, repoUrl, defaultBranch);
export const renameWorkspaceForUser = renameRoomForUser;
export const bindRepoToWorkspaceForUser = bindRepoToRoomForUser;
export const ensureActiveWorkspaceForUser = ensureActiveRoomForUser;
export const deleteWorkspaceForUser = deleteRoomForUser;
