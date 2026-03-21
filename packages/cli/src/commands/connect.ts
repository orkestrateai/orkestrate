/**
 * orkestrate connect [tool]
 *
 * Configure Orkestrate MCP for any AI coding tool.
 *
 * With a tool name: auto-configure supported tools (claude, opencode, etc.)
 * Without a tool name: show detected tools + generic MCP setup instructions
 */

import { getCredentials, getServerUrl } from "../lib/config.js";
import { configureTool, detectTools, type ToolName } from "../lib/detect.js";
import { ui } from "../lib/ui.js";

const SUPPORTED_AUTO_CONFIG: ToolName[] = [
  "claude",
  "opencode",
  "cursor",
  "windsurf",
  "codex",
];

export async function connectCommand(toolName?: string): Promise<void> {
  const creds = getCredentials();
  if (!creds?.accessToken) {
    ui.error("Not authenticated. Run `orkestrate login` first.");
    process.exit(1);
  }

  // ── No tool specified: show detection + generic instructions ───────────────
  if (!toolName) {
    ui.header("Connect Orkestrate MCP");

    const detected = detectTools();
    const found = detected.filter((t) => t.detected);

    if (found.length > 0) {
      ui.info("Detected AI tools:");
      for (const tool of found) {
        ui.success(`  ${tool.displayName}`);
      }
      ui.blank();
    }

    displayGenericInstructions();
    return;
  }

  // ── Generic MCP tool (not in auto-config list) ────────────────────────────
  const normalized = toolName.toLowerCase().trim();
  const isAutoConfig = SUPPORTED_AUTO_CONFIG.includes(normalized as ToolName);

  if (!isAutoConfig) {
    ui.header(`Connect ${normalized} to Orkestrate`);
    ui.blank();
    ui.info("Orkestrate MCP endpoint:");
    ui.line(`  ${getServerUrl()}/api/mcp`);
    ui.blank();

    displayGenericInstructions();

    ui.blank();
    ui.info(
      `To configure ${normalized} with Orkestrate MCP, add it as a stdio MCP server.`,
    );
    ui.dim(
      `Restart ${normalized} after configuring MCP for changes to take effect.`,
    );
    return;
  }

  // ── Auto-configure supported tool ──────────────────────────────────────────
  ui.info(`Configuring Orkestrate MCP for ${toolName}...`);

  const result = await configureTool(normalized as ToolName);

  if (result.success) {
    ui.success(result.message);
    ui.blank();
    ui.info("Your AI tool is now connected to Orkestrate.");
    ui.dim("Restart your tool if it's currently running.");
  } else {
    ui.error(result.message);
    process.exit(1);
  }
}

function displayGenericInstructions(): void {
  const mcpUrl = `${getServerUrl()}/api/mcp`;
  const bridgeCommand = "orkestrate";
  const bridgeArgs = "mcp";

  ui.info("Generic MCP Setup (for any tool that supports stdio MCP):");
  ui.blank();

  ui.line("  Add Orkestrate as an MCP server with:");
  ui.blank();
  ui.line(`    Command:  ${bridgeCommand}`);
  ui.line(`    Args:     ${bridgeArgs}`);
  ui.blank();

  ui.dim("  Tool-specific setup:");

  ui.blank();
  ui.line("  Claude Code:");
  ui.line(
    `    claude mcp add --transport stdio Orkestrate ${bridgeCommand} ${bridgeArgs}`,
  );

  ui.blank();
  ui.line("  Cursor:");
  ui.line("    Settings → MCP → Add new server:");
  ui.line(`      Name: Orkestrate`);
  ui.line(`      Command: ${bridgeCommand}`);
  ui.line(`      Args: ${bridgeArgs}`);

  ui.blank();
  ui.line("  Windsurf:");
  ui.line("    Settings → MCP → Add server:");
  ui.line(`      Command: ${bridgeCommand}`);
  ui.line(`      Args: ${bridgeArgs}`);

  ui.blank();
  ui.line("  OpenCode:");
  ui.line("    Add to opencode.json mcp servers:");

  ui.blank();
  ui.line("  Codex:");
  ui.line(`    Add to ~/.codex/config.toml:`);
  ui.line(`      [mcp_servers.Orkestrate]`);
  ui.line(`      command = "${bridgeCommand}"`);
  ui.line(`      args = ["${bridgeArgs}"]`);

  ui.blank();
  ui.dim(
    "  Not sure if your tool supports MCP? Check its docs for 'MCP server'.",
  );
}
