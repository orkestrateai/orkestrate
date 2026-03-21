/**
 * orkestrate workspace [list|switch|create]
 *
 * Manage workspaces from the CLI.
 */

import { getCredentials, setActiveWorkspace, getActiveWorkspace } from "../lib/config.js";
import {
  listWorkspaces,
  switchWorkspace as apiSwitchWorkspace,
  createWorkspace as apiCreateWorkspace,
} from "../lib/api.js";
import { ui } from "../lib/ui.js";

export async function workspaceCommand(
  action?: string,
  nameOrId?: string,
  extra?: string,
): Promise<void> {
  const creds = getCredentials();
  if (!creds?.accessToken) {
    ui.error("Not authenticated. Run `orkestrate login` first.");
    process.exit(1);
  }

  const subcommand = (action || "list").toLowerCase();

  switch (subcommand) {
    case "list":
    case "ls":
      return workspaceList();

    case "switch":
    case "use":
      if (!nameOrId) {
        ui.error("Usage: orkestrate workspace switch <workspace-id-or-name>");
        process.exit(1);
      }
      return workspaceSwitch(nameOrId);

    case "create":
    case "new":
      if (!nameOrId) {
        ui.error("Usage: orkestrate workspace create <name> <repo-url> [branch]");
        process.exit(1);
      }
      return workspaceCreate(nameOrId, extra);

    default:
      ui.error(`Unknown subcommand: ${action}`);
      ui.blank();
      ui.info("Available subcommands:");
      ui.line("  list     — Show all workspaces");
      ui.line("  switch   — Switch active workspace");
      ui.line("  create   — Create a new workspace");
      process.exit(1);
  }
}

async function workspaceList(): Promise<void> {
  ui.header("Workspaces");

  try {
    const workspaces = await listWorkspaces();
    const active = getActiveWorkspace();

    if (workspaces.length === 0) {
      ui.dim("No workspaces found.");
      ui.info("Create one at orkestrate.space or run `orkestrate workspace create`.");
      return;
    }

    for (const ws of workspaces) {
      const isActive = ws.id === active.id || ws.isActive;
      const marker = isActive ? " ← active" : "";
      const name = ws.name || "Unnamed";

      if (isActive) {
        ui.success(`${name} (${ws.id})${marker}`);
      } else {
        ui.line(`  ${name} (${ws.id})`);
      }

      if (ws.repoUrl) {
        ui.dim(`    repo: ${ws.repoUrl}`);
      }
    }

    ui.blank();
    ui.dim(`${workspaces.length} workspace(s)`);
  } catch (err) {
    ui.error(`Failed to list workspaces: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

async function workspaceSwitch(nameOrId: string): Promise<void> {
  try {
    const workspaces = await listWorkspaces();

    // Find by exact ID or name match
    const target = workspaces.find(
      (ws) =>
        ws.id === nameOrId ||
        ws.name.toLowerCase() === nameOrId.toLowerCase(),
    );

    if (!target) {
      ui.error(`Workspace not found: ${nameOrId}`);
      ui.blank();
      ui.info("Available workspaces:");
      for (const ws of workspaces) {
        ui.line(`  ${ws.name} (${ws.id})`);
      }
      process.exit(1);
    }

    await apiSwitchWorkspace(target.id);
    setActiveWorkspace(target.id, target.name);
    ui.success(`Switched to workspace: ${target.name}`);
  } catch (err) {
    ui.error(`Failed to switch workspace: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

async function workspaceCreate(name: string, repoUrl?: string): Promise<void> {
  if (!repoUrl) {
    ui.error("Repository URL is required.");
    ui.info("Usage: orkestrate workspace create <name> <repo-url>");
    process.exit(1);
  }

  try {
    const workspace = await apiCreateWorkspace(name, repoUrl, "main");
    setActiveWorkspace(workspace.id, workspace.name || name);
    ui.success(`Created workspace: ${workspace.name || name}`);
    ui.kv("ID", workspace.id);
    ui.kv("Repo", repoUrl);
  } catch (err) {
    ui.error(`Failed to create workspace: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}
