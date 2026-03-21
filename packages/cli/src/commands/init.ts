/**
 * orkestrate init
 *
 * Initialize Orkestrate in the current project directory.
 * Detects git context and binds to the matching workspace.
 */

import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getCredentials, getActiveWorkspace, setActiveWorkspace } from "../lib/config.js";
import { detectGitContext } from "../lib/git.js";
import { listWorkspaces } from "../lib/api.js";
import { detectTools } from "../lib/detect.js";
import { ui } from "../lib/ui.js";

export async function initCommand(): Promise<void> {
  const creds = getCredentials();
  if (!creds?.accessToken) {
    ui.error("Not authenticated. Run `orkestrate login` first.");
    process.exit(1);
  }

  const cwd = process.cwd();

  ui.header("Initializing Orkestrate");

  // Step 1: Detect git context
  const git = detectGitContext(cwd);
  if (git) {
    ui.success(`Git repository detected`);
    ui.kv("Remote", git.remote || "(no remote)");
    ui.kv("Branch", git.branch);
    ui.kv("HEAD", git.headSha.slice(0, 8));
    ui.kv("Dirty", git.dirty ? "yes" : "clean");
  } else {
    ui.warn("No git repository detected in current directory.");
    ui.dim("Orkestrate works best with a git repository.");
  }

  ui.blank();

  // Step 2: Match to workspace
  try {
    const workspaces = await listWorkspaces();
    let matched = false;

    if (git?.remote && workspaces.length > 0) {
      // Try to match by repo URL
      const normalizedRemote = normalizeGitUrl(git.remote);
      const match = workspaces.find((ws) => {
        if (!ws.repoUrl) return false;
        return normalizeGitUrl(ws.repoUrl) === normalizedRemote;
      });

      if (match) {
        setActiveWorkspace(match.id, match.name);
        ui.success(`Matched to workspace: ${match.name}`);
        ui.kv("Workspace ID", match.id);
        matched = true;
      }
    }

    if (!matched) {
      if (git?.remote) {
        const create = await ui.confirm(`No matching workspace found for this repository. Create one?`);
        if (create) {
          const name = await ui.input("Workspace name", git.remote.split("/").pop()?.replace(/\.git$/, ""));
          try {
            const { createWorkspace } = await import("../lib/api.js");
            const workspace = await createWorkspace(name, git.remote, git.branch || "main");
            setActiveWorkspace(workspace.id, workspace.name);
            ui.success(`Created and matched to workspace: ${workspace.name}`);
            ui.kv("Workspace ID", workspace.id);
            matched = true;
          } catch (err) {
            ui.error(`Failed to create workspace: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
      }

      if (!matched) {
        const active = getActiveWorkspace();
        if (active.id) {
          ui.info(`Using current active workspace: ${active.name || active.id}`);
        } else if (workspaces.length > 0) {
          ui.info("Available workspaces:");
          for (const ws of workspaces.slice(0, 5)) {
            ui.line(`  • ${ws.name} (${ws.id})`);
          }
          const wsId = await ui.input("Enter workspace ID to link (or leave blank)");
          if (wsId) {
             const selected = workspaces.find(w => w.id === wsId || w.name === wsId);
             if (selected) {
                 setActiveWorkspace(selected.id, selected.name);
                 ui.success(`Linked to workspace: ${selected.name}`);
                 matched = true;
             }
          }
        }
      }
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes("401")) {
      ui.warn("Authentication failed (401). Your session may have expired.");
      ui.info("Please run `orkestrate login` to refresh your session.");
    } else {
      ui.dim(`Could not fetch workspaces: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  ui.blank();

  // Step 3: Detect available tools
  const tools = detectTools(cwd);
  const found = tools.filter((t) => t.detected);

  if (found.length > 0) {
    ui.info("Detected AI tools:");
    for (const tool of found) {
      ui.line(`  • ${tool.displayName}`);
    }
    ui.blank();
    const connect = await ui.confirm(`Would you like to connect ${found[0].displayName} now?`);
    if (connect) {
        const { configureTool } = await import("../lib/detect.js");
        const res = await configureTool(found[0].name, cwd);
        if (res.success) {
            ui.success(res.message);
        } else {
            ui.error(res.message);
        }
    } else {
        ui.info(`You can connect later with \`orkestrate connect ${found[0].name}\``);
    }
  } else {
    ui.dim("No AI coding tools detected. Install one and run `orkestrate connect <tool>`.");
  }

  // Step 4: Write .orkestrate.json (project marker)
  const configFile = join(cwd, ".orkestrate.json");
  const activeWs = getActiveWorkspace();
  
  if (!existsSync(configFile)) {
    if (activeWs.id) {
        const projectConfig = {
          $schema: "https://orkestrate.space/schema/project.json",
          workspaceId: activeWs.id,
          server: "https://orkestrate.space",
          initialized: new Date().toISOString(),
        };

        writeFileSync(configFile, JSON.stringify(projectConfig, null, 2) + "\n", "utf-8");
        ui.blank();
        ui.success(`Created .orkestrate.json`);
        ui.dim("This file identifies your project workspace. It is gitignored by default.");
    }
  } else {
    // Sync existing config if it has a different WS ID
    try {
        const { readFileSync } = await import("node:fs");
        const existing = JSON.parse(readFileSync(configFile, "utf-8"));
        if (activeWs.id && existing.workspaceId !== activeWs.id) {
            existing.workspaceId = activeWs.id;
            writeFileSync(configFile, JSON.stringify(existing, null, 2) + "\n", "utf-8");
            ui.success(`Updated .orkestrate.json with workspace ID ${activeWs.id}`);
        }
    } catch {}
  }

  ui.blank();
}

/**
 * Normalize a git remote URL for comparison.
 */
function normalizeGitUrl(url: string): string {
  let normalized = url.trim().toLowerCase();
  normalized = normalized.replace(/\.git$/, "");
  
  const sshMatch = normalized.match(/^git@([^:]+):(.+)$/);
  if (sshMatch) {
    normalized = `${sshMatch[1]}/${sshMatch[2]}`;
  }
  
  normalized = normalized.replace(/^https?:\/\//, "");
  normalized = normalized.replace(/^ssh:\/\//, "");
  normalized = normalized.replace(/\/$/, "");
  return normalized;
}
