import { NextRequest, NextResponse } from "next/server";
import { authenticateRequestUser } from "@/lib/auth-user-request";
import {
  createWorkspaceForUser,
  deleteWorkspaceForUser,
  ensureActiveWorkspaceForUser,
  listWorkspacesForUser,
  renameWorkspaceForUser,
  bindRepoToWorkspaceForUser,
  setActiveWorkspaceForUser,
} from "@/lib/workspaces-core";

type WorkspaceAction = "create" | "switch" | "delete" | "rename" | "bind-repo";

function parseAction(value: unknown): WorkspaceAction | null {
  return value === "create" || value === "switch" || value === "delete" || value === "rename" || value === "bind-repo" ? value : null;
}

function targetWorkspaceId(payload: Record<string, unknown>) {
  const workspaceId = typeof payload.workspaceId === "string" ? payload.workspaceId : "";
  const roomId = typeof payload.roomId === "string" ? payload.roomId : "";
  return workspaceId || roomId || "";
}

function noStoreJson(payload: unknown, status = 200) {
  return NextResponse.json(payload, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(req: NextRequest) {
  try {
    const user = await authenticateRequestUser(req);
    if (!user?.id) return noStoreJson({ error: "Unauthorized" }, 401);

    const activeWorkspaceId = await ensureActiveWorkspaceForUser(user.id);
    const workspaces = await listWorkspacesForUser(user.id);

    if (!activeWorkspaceId && workspaces.length === 0) {
      return noStoreJson({ workspaces: [], rooms: [], needsSetup: true });
    }

    return noStoreJson({ workspaces, rooms: workspaces });
  } catch (error) {
    return noStoreJson({ error: "Internal server error", detail: error instanceof Error ? error.message : String(error) }, 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await authenticateRequestUser(req);
    if (!user?.id) return noStoreJson({ error: "Unauthorized" }, 401);

    const payload = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const action = parseAction(payload.action);
    const workspaceId = targetWorkspaceId(payload);
    const name = typeof payload.name === "string" ? payload.name : "";

    if (action === "create") {
      const repoUrl = typeof payload.repoUrl === "string" ? payload.repoUrl.trim() : "";
      const defaultBranch = typeof payload.defaultBranch === "string" ? payload.defaultBranch.trim() : "";

      if (!repoUrl) {
        return noStoreJson({ error: "Git repository URL is required. Please provide a repoUrl." }, 400);
      }
      if (!defaultBranch) {
        return noStoreJson({ error: "Default branch is required. Please provide a defaultBranch." }, 400);
      }

      const workspace = await createWorkspaceForUser(user.id, name || undefined, repoUrl, defaultBranch);
      return noStoreJson({ workspace, room: workspace });
    }

    if (action === "switch") {
      if (!workspaceId) return noStoreJson({ error: "Missing workspaceId" }, 400);
      const ok = await setActiveWorkspaceForUser(user.id, workspaceId);
      if (!ok) return noStoreJson({ error: "Workspace not accessible" }, 403);
      return noStoreJson({ success: true, workspaceId, roomId: workspaceId });
    }

    if (action === "delete") {
      if (!workspaceId) return noStoreJson({ error: "Missing workspaceId" }, 400);
      const ok = await deleteWorkspaceForUser(user.id, workspaceId);
      if (!ok) return noStoreJson({ error: "Delete not allowed" }, 403);
      return noStoreJson({ success: true, workspaceId, roomId: workspaceId });
    }

    if (action === "rename") {
      if (!workspaceId) return noStoreJson({ error: "Missing workspaceId" }, 400);
      if (!name.trim()) return noStoreJson({ error: "Missing name" }, 400);
      const ok = await renameWorkspaceForUser(user.id, workspaceId, name);
      if (!ok) return noStoreJson({ error: "Rename not allowed" }, 403);
      return noStoreJson({ success: true, workspaceId, roomId: workspaceId, name: name.trim() });
    }

    if (action === "bind-repo") {
      if (!workspaceId) return noStoreJson({ error: "Missing workspaceId" }, 400);
      const repoUrl = typeof payload.repoUrl === "string" ? payload.repoUrl : null;
      const ok = await bindRepoToWorkspaceForUser(user.id, workspaceId, repoUrl);
      if (!ok) return noStoreJson({ error: "Repo binding not allowed" }, 403);
      return noStoreJson({ success: true, workspaceId, roomId: workspaceId, repoUrl });
    }

    return noStoreJson({ error: "Invalid action" }, 400);
  } catch (error) {
    return noStoreJson({ error: "Internal server error", detail: error instanceof Error ? error.message : String(error) }, 500);
  }
}
