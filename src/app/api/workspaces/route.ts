import { NextRequest, NextResponse } from "next/server";
import { authenticateRequestUser } from "@/lib/auth-user-request";
import { hasGithubConnection } from "@/lib/github-tokens";
import {
  createWorkspaceForUser,
  deleteWorkspaceForUser,
  ensureActiveWorkspaceForUser,
  listWorkspacesForUser,
  renameWorkspaceForUser,
  bindRepoToWorkspaceForUser,
  setActiveWorkspaceForUser,
} from "@/lib/workspaces-core";
import { createWorkspaceBranchOnGitHub } from "@/lib/github-branch";

type WorkspaceAction = "create" | "switch" | "delete" | "rename" | "bind-repo";

function parseAction(value: unknown): WorkspaceAction | null {
  return value === "create" ||
    value === "switch" ||
    value === "delete" ||
    value === "rename" ||
    value === "bind-repo"
    ? value
    : null;
}

function targetWorkspaceId(payload: Record<string, unknown>) {
  return typeof payload.workspaceId === "string" ? payload.workspaceId : "";
}

function noStoreJson(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(req: NextRequest) {
  try {
    const user = await authenticateRequestUser(req);
    if (!user?.id) return noStoreJson({ error: "Unauthorized" }, 401);

    const activeWorkspaceId = await ensureActiveWorkspaceForUser(user.id);
    const workspaces = await listWorkspacesForUser(user.id);

    if (!activeWorkspaceId && workspaces.length === 0) {
      return noStoreJson({ workspaces: [], needsSetup: true });
    }

    return noStoreJson({ workspaces });
  } catch (error) {
    return noStoreJson(
      {
        error: "Internal server error",
        detail: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await authenticateRequestUser(req);
    if (!user?.id) return noStoreJson({ error: "Unauthorized" }, 401);

    const payload = (await req.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const action = parseAction(payload.action);
    const workspaceId = targetWorkspaceId(payload);
    const name = typeof payload.name === "string" ? payload.name : "";

    if (action === "create") {
      const repoUrl =
        typeof payload.repoUrl === "string" ? payload.repoUrl.trim() : "";
      const baseBranch =
        typeof payload.baseBranch === "string"
          ? payload.baseBranch.trim() || "main"
          : "main";

      if (!repoUrl) {
        return noStoreJson({ error: "Git repository URL is required." }, 400);
      }

      const githubConnected = await hasGithubConnection(user.id);
      if (!githubConnected) {
        return noStoreJson(
          {
            error:
              "GitHub account not connected. Connect GitHub in Settings before creating a workspace.",
          },
          403,
        );
      }

      const result = await createWorkspaceForUser(
        user.id,
        name || undefined,
        repoUrl,
        baseBranch,
      );

      if (result.error === "limit_reached") {
        return noStoreJson(
          {
            error:
              "Workspace limit reached for your plan. Upgrade to create more workspaces.",
          },
          403,
        );
      }

      if (result.error === "unknown" || !result.workspace) {
        return noStoreJson({ error: "Failed to create workspace." }, 500);
      }

      const { workspace } = result;

      const branchResult = await createWorkspaceBranchOnGitHub(
        user.id,
        repoUrl,
        workspace.id,
        baseBranch,
      );
      if (!branchResult.success) {
        console.error("Failed to create workspace branch:", branchResult.error);
      }

      return noStoreJson({ workspace });
    }

    if (action === "switch") {
      if (!workspaceId)
        return noStoreJson({ error: "Missing workspaceId" }, 400);
      const ok = await setActiveWorkspaceForUser(user.id, workspaceId);
      if (!ok) return noStoreJson({ error: "Workspace not accessible" }, 403);
      return noStoreJson({ success: true, workspaceId });
    }

    if (action === "delete") {
      if (!workspaceId)
        return noStoreJson({ error: "Missing workspaceId" }, 400);
      const ok = await deleteWorkspaceForUser(user.id, workspaceId);
      if (!ok) return noStoreJson({ error: "Delete not allowed" }, 403);
      return noStoreJson({ success: true, workspaceId });
    }

    if (action === "rename") {
      if (!workspaceId)
        return noStoreJson({ error: "Missing workspaceId" }, 400);
      if (!name.trim()) return noStoreJson({ error: "Missing name" }, 400);
      const ok = await renameWorkspaceForUser(user.id, workspaceId, name);
      if (!ok) return noStoreJson({ error: "Rename not allowed" }, 403);
      return noStoreJson({ success: true, workspaceId, name: name.trim() });
    }

    if (action === "bind-repo") {
      if (!workspaceId)
        return noStoreJson({ error: "Missing workspaceId" }, 400);
      const repoUrl =
        typeof payload.repoUrl === "string" ? payload.repoUrl : null;
      const baseBranch =
        typeof payload.baseBranch === "string"
          ? payload.baseBranch.trim() || "main"
          : "main";
      const ok = await bindRepoToWorkspaceForUser(
        user.id,
        workspaceId,
        repoUrl,
        baseBranch,
      );
      if (!ok) return noStoreJson({ error: "Repo binding not allowed" }, 403);

      if (repoUrl) {
        const branchResult = await createWorkspaceBranchOnGitHub(
          user.id,
          repoUrl,
          workspaceId,
          baseBranch,
        );
        if (!branchResult.success) {
          console.error(
            "Failed to create workspace branch:",
            branchResult.error,
          );
        }
      }

      return noStoreJson({ success: true, workspaceId, repoUrl });
    }

    return noStoreJson({ error: "Invalid action" }, 400);
  } catch (error) {
    return noStoreJson(
      {
        error: "Internal server error",
        detail: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
}
