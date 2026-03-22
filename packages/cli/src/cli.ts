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
  .version("0.1.14")
  .hook("preAction", () => {
    // Show banner on all commands
  });

// --- login ---
program
  .command("login")
  .description("Authenticate with Orkestrate via browser OAuth")
  .action(async () => {
    const { loginCommand } = await import("./commands/login.js");
    await loginCommand();
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
  .action(async () => {
    try {
      const { mcpCommand } = await import("./commands/mcp.js");
      await mcpCommand();
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
