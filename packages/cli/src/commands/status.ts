/**
 * orkestrate status
 *
 * Display current team coordination state in the terminal.
 */

import { getCredentials, getActiveWorkspace } from "../lib/config.js";
import { getTeamStatus, listWorkspaces, checkHealth } from "../lib/api.js";
import { ui } from "../lib/ui.js";

export async function statusCommand(): Promise<void> {
  const creds = getCredentials();
  if (!creds?.accessToken) {
    ui.error("Not authenticated. Run `orkestrate login` first.");
    process.exit(1);
  }

  // Check server health
  const healthy = await checkHealth();
  if (!healthy) {
    ui.error("Cannot reach Orkestrate server. Check your connection.");
    process.exit(1);
  }

  const workspace = getActiveWorkspace();

  ui.header("Orkestrate Status");

  // Show workspace info
  if (workspace.name) {
    ui.kv("Workspace", workspace.name);
  }
  if (workspace.id) {
    ui.kv("ID", workspace.id);
  }
  ui.blank();

  try {
    const { agents, stateHash } = await getTeamStatus();

    if (agents.length === 0) {
      ui.dim("No active agents in this workspace.");
      ui.blank();
      ui.info("Connect an agent with `orkestrate connect <tool>` to get started.");
      return;
    }

    // Build table
    const rows = agents.map((agent) => [
      agent.agentId || agent.scopedAgentId,
      agent.toolName || "—",
      agent.status,
      truncate(agent.objective, 35),
    ]);

    ui.table(
      ["Agent", "Tool", "Status", "Objective"],
      rows,
    );

    // Show claimed paths summary
    const agentsWithClaims = agents.filter(
      (a) => a.claimedPaths && a.claimedPaths.length > 0,
    );
    if (agentsWithClaims.length > 0) {
      ui.blank();
      ui.line(pc_bold("Active Scope Claims:"));
      for (const agent of agentsWithClaims) {
        ui.line(`  ${agent.agentId}: ${agent.claimedPaths.join(", ")}`);
      }
    }

    ui.blank();
    ui.dim(`State hash: ${stateHash}`);
    ui.dim(`${agents.length} agent(s) connected`);
  } catch (err) {
    ui.error(
      `Failed to fetch status: ${err instanceof Error ? err.message : String(err)}`,
    );
    process.exit(1);
  }
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
}

// Inline bold since we don't want to import picocolors at top level just for one use
function pc_bold(s: string): string {
  return `\x1b[1m${s}\x1b[22m`;
}
