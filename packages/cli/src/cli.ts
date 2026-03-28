/**
 * Orkestrate CLI
 *
 * The coordination layer for autonomous AI coding agents.
 * https://orkestrate.space
 */

import { Command } from "commander";
import { ui } from "./lib/ui.js";

const program = new Command();

program
  .name("orkestrate")
  .description("The coordination layer for autonomous AI coding agents")
  .version("0.1.15")
  .hook("preAction", () => {
    // Show banner on all commands
  });

// --- login ---
program
  .command("login")
  .description("Authenticate with Orkestrate via browser OAuth")
  .option(
    "--github",
    "Run GitHub device authorization during login (optional)",
  )
  .option(
    "--skip-github",
    "Skip GitHub authorization during login (default behavior)",
  )
  .action(async (opts: { github?: boolean; skipGithub?: boolean }) => {
    const { loginCommand } = await import("./commands/login.js");
    await loginCommand(opts);
  });

// --- logout ---
program
  .command("logout")
  .description("Clear stored credentials")
  .action(async () => {
    const { logoutCommand } = await import("./commands/logout.js");
    logoutCommand();
  });

// --- connect ---
program
  .command("connect [tool]")
  .description(
    "Configure MCP endpoint for an AI coding tool (claude, opencode, cursor, windsurf, codex)",
  )
  .action(async (tool?: string) => {
    const { connectCommand } = await import("./commands/connect.js");
    await connectCommand(tool);
  });

// --- status ---
program
  .command("status")
  .alias("s")
  .description("Show current team coordination state")
  .action(async () => {
    const { statusCommand } = await import("./commands/status.js");
    await statusCommand();
  });

// --- workspace ---
program
  .command("workspace [action] [name] [extra]")
  .alias("ws")
  .description("Manage workspaces (list, switch, create)")
  .action(async (action?: string, name?: string, extra?: string) => {
    const { workspaceCommand } = await import("./commands/workspace.js");
    await workspaceCommand(action, name, extra);
  });

// --- init ---
program
  .command("init")
  .description("Initialize Orkestrate in the current project")
  .action(async () => {
    const { initCommand } = await import("./commands/init.js");
    await initCommand();
  });

// --- mcp ---
program
  .command("mcp")
  .description("Run as a local MCP server (stdio bridge to Orkestrate Cloud)")
  .option(
    "--parent-tool <tool>",
    "The AI coding tool invoking this bridge (claude, zed, cursor, etc.)",
  )
  .action(async (opts) => {
    try {
      const { mcpCommand } = await import("./commands/mcp.js");
      await mcpCommand(opts);
    } catch (err) {
      process.stderr.write(
        `[Orkestrate-MCP] ${err instanceof Error ? err.message : String(err)}\n`,
      );
      process.exit(1);
    }
  });

// --- whoami ---
program
  .command("whoami")
  .description("Show current authentication and configuration")
  .action(async () => {
    const { whoamiCommand } = await import("./commands/whoami.js");
    await whoamiCommand();
  });

// --- tools ---
program
  .command("tools")
  .description("Manage enabled/disabled tools for local MCP proxy")
  .option("--list", "List current tool filter settings")
  .option("--enable <tool>", "Enable a specific tool")
  .option("--disable <tool>", "Disable a specific tool")
  .action(async (opts) => {
    const { toolsCommand } = await import("./commands/tools.js");
    await toolsCommand(opts);
  });

// --- Default: show banner + help ---
program.action(() => {
  ui.banner();
  program.help();
});

// Run
program.parseAsync(process.argv).catch((err) => {
  ui.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
