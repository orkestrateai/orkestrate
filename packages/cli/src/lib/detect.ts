/**
 * Orkestrate CLI — Tool Detection & MCP Configuration
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { execSync } from "node:child_process";

export type ToolName =
  | "claude"
  | "opencode"
  | "cursor"
  | "windsurf"
  | "codex"
  | "zed";

export interface DetectedTool {
  name: ToolName;
  displayName: string;
  detected: boolean;
  configPath?: string;
}

function getZedConfigPath(): string {
  if (process.platform === "win32") {
    return join(homedir(), "AppData", "Roaming", "Zed", "settings.json");
  }
  return join(homedir(), ".config", "zed", "settings.json");
}

/**
 * Detect which AI coding tools are available on this system.
 */
export function detectTools(
  projectDir: string = process.cwd(),
): DetectedTool[] {
  const tools: DetectedTool[] = [];

  // Claude Code
  tools.push({
    name: "claude",
    displayName: "Claude Code",
    detected: isCommandAvailable("claude"),
  });

  // OpenCode
  const opencodeConfig = join(projectDir, "opencode.json");
  tools.push({
    name: "opencode",
    displayName: "OpenCode",
    detected: existsSync(opencodeConfig) || isCommandAvailable("opencode"),
    configPath: opencodeConfig,
  });

  // Cursor
  const cursorConfig = join(projectDir, ".cursor", "mcp.json");
  tools.push({
    name: "cursor",
    displayName: "Cursor",
    detected:
      existsSync(join(projectDir, ".cursor")) || existsSync(cursorConfig),
    configPath: cursorConfig,
  });

  // Windsurf
  const windsurfConfig = join(projectDir, ".windsurf", "mcp.json");
  tools.push({
    name: "windsurf",
    displayName: "Windsurf",
    detected:
      existsSync(join(projectDir, ".windsurf")) || existsSync(windsurfConfig),
    configPath: windsurfConfig,
  });

  // Codex
  const codexDir = join(homedir(), ".codex");
  tools.push({
    name: "codex",
    displayName: "Codex CLI",
    detected: isCommandAvailable("codex") || existsSync(codexDir),
  });

  // Zed
  const zedConfig = getZedConfigPath();
  tools.push({
    name: "zed",
    displayName: "Zed",
    detected: existsSync(zedConfig),
    configPath: zedConfig,
  });

  return tools;
}

/**
 * Configure MCP for a specific tool.
 */
export async function configureTool(
  tool: ToolName,
  projectDir: string = process.cwd(),
): Promise<{ success: boolean; message: string }> {
  const bridge = resolveMcpBridge(tool);

  switch (tool) {
    case "claude":
      return configureClaudeCode(bridge);
    case "opencode":
      return configureOpenCode(join(projectDir, "opencode.json"), bridge, tool);
    case "cursor":
      return configureMcpServersJson(
        "Cursor",
        join(projectDir, ".cursor", "mcp.json"),
        bridge,
        tool,
      );
    case "windsurf":
      return configureMcpServersJson(
        "Windsurf",
        join(projectDir, ".windsurf", "mcp.json"),
        bridge,
        tool,
      );
    case "codex":
      return configureCodex(bridge, tool);
    case "zed":
      return configureZed(bridge, tool);
    default:
      return { success: false, message: `Unknown tool: ${tool}` };
  }
}

/**
 * Resolves the global command to run the Orkestrate MCP bridge.
 */
function resolveMcpBridge(tool: ToolName): { command: string; args: string[] } {
  return {
    command: "orkestrate",
    args: ["mcp", "--parent-tool", tool],
  };
}

// ──────────────────────────────────────────────
// Tool Specific Configs (Global Command standard)
// ──────────────────────────────────────────────

function configureClaudeCode(bridge: { command: string; args: string[] }): {
  success: boolean;
  message: string;
} {
  if (!isCommandAvailable("claude"))
    return { success: false, message: "Claude Code CLI not found." };

  try {
    // Attempt to remove existing first (idempotency)
    try {
      execSync("claude mcp remove Orkestrate", { stdio: "pipe" });
    } catch {
      /* ignore if not exists */
    }

    // Claude expects: claude mcp add <name> <command> [args...]
    const commandToRun = bridge.command;
    const argsToRun = bridge.args.join(" ");

    execSync(
      `claude mcp add --transport stdio --scope project Osrkestrate -- ${commandToRun} ${argsToRun}`,
      { stdio: "pipe", encoding: "utf-8" },
    );
    return { success: true, message: "MCP added to Claude Code." };
  } catch (err) {
    return {
      success: false,
      message: `Claude config failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

function configureOpenCode(
  configPath: string,
  bridge: { command: string; args: string[] },
  tool: ToolName,
): { success: boolean; message: string } {
  try {
    const config = existsSync(configPath)
      ? JSON.parse(readFileSync(configPath, "utf-8"))
      : {};
    if (!config.mcp || typeof config.mcp !== "object") config.mcp = {};

    config.mcp["Orkestrate"] = {
      type: "local",
      command: [bridge.command, ...bridge.args],
      enabled: true,
      env: { ORKESTRATE_PARENT_TOOL: tool },
    };

    writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
    return { success: true, message: `Configured OpenCode at ${configPath}` };
  } catch (err) {
    return {
      success: false,
      message: `OpenCode config failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

function configureMcpServersJson(
  displayName: string,
  configPath: string,
  bridge: { command: string; args: string[] },
  tool: ToolName,
): { success: boolean; message: string } {
  try {
    const dir = join(configPath, "..");
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    const config = existsSync(configPath)
      ? JSON.parse(readFileSync(configPath, "utf-8"))
      : {};
    if (!config.mcpServers || typeof config.mcpServers !== "object")
      config.mcpServers = {};

    config.mcpServers["Orkestrate"] = {
      command: bridge.command,
      args: bridge.args,
      env: { ORKESTRATE_PARENT_TOOL: tool },
    };

    writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
    return {
      success: true,
      message: `Configured ${displayName} at ${configPath}`,
    };
  } catch (err) {
    return {
      success: false,
      message: `${displayName} config failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

function configureZed(
  bridge: { command: string; args: string[] },
  tool: ToolName,
): {
  success: boolean;
  message: string;
} {
  const configPath = getZedConfigPath();
  try {
    const dir = join(configPath, "..");
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    // Build the server entry as a properly formatted object
    const serverEntry: Record<string, unknown> = {
      enabled: true,
      remote: false,
      command: bridge.command,
      args: bridge.args,
      env: { ORKESTRATE_PARENT_TOOL: tool },
    };

    // Parse existing config ( Zed supports JSON with comments/trailing commas)
    let config: Record<string, unknown> = {};
    if (existsSync(configPath)) {
      const content = readFileSync(configPath, "utf-8").trim();
      const jsonStart = content.indexOf("{");
      const trimmedContent = jsonStart >= 0 ? content.slice(jsonStart) : "";
      if (trimmedContent) {
        try {
          // Use Function constructor instead of JSON.parse to handle trailing commas and comments
          // eslint-disable-next-line no-new-func
          config = new Function("return " + trimmedContent)();
        } catch {
          return {
            success: false,
            message:
              "Zed config is not valid JSON - manual configuration required",
          };
        }
      }
    }

    // Initialize context_servers if needed
    if (!config.context_servers || typeof config.context_servers !== "object") {
      config.context_servers = {};
    }

    // Update or add the mcp-server-orkestrate entry
    (config.context_servers as Record<string, unknown>)[
      "mcp-server-orkestrate"
    ] = serverEntry;

    // Re-serialize with 2-space indent
    writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
    return {
      success: true,
      message: `Configured Zed at ${configPath}`,
    };
  } catch (err) {
    return {
      success: false,
      message: `Zed config failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

function configureCodex(
  bridge: { command: string; args: string[] },
  tool: ToolName,
): {
  success: boolean;
  message: string;
} {
  const home = homedir();
  const codexDir = join(home, ".codex");
  const configPath = join(codexDir, "config.toml");

  try {
    if (!existsSync(codexDir)) mkdirSync(codexDir, { recursive: true });

    let content = existsSync(configPath)
      ? readFileSync(configPath, "utf-8")
      : "[mcp_servers]\n";
    const proxySection = `[mcp_servers.Orkestrate]\ncommand = "${bridge.command}"\nargs = [${bridge.args.map((a) => `"${a}"`).join(", ")}]\nenv = { ORKESTRATE_PARENT_TOOL = "${tool}" }\n`;

    const sectionRegex = /\[mcp_servers\.Orkestrate\]\s*\n(?:(?!\[)[^\n]*\n?)*/;
    if (sectionRegex.test(content)) {
      content = content.replace(sectionRegex, proxySection);
    } else {
      const mcpServersIdx = content.indexOf("[mcp_servers]");
      if (mcpServersIdx !== -1) {
        const lineEnd = content.indexOf("\n", mcpServersIdx);
        const insertPos = lineEnd !== -1 ? lineEnd + 1 : content.length;
        content =
          content.slice(0, insertPos) +
          "\n" +
          proxySection +
          content.slice(insertPos);
      } else {
        content = content.trimEnd() + "\n\n[mcp_servers]\n\n" + proxySection;
      }
    }

    writeFileSync(configPath, content, "utf-8");
    return { success: true, message: `Configured Codex.` };
  } catch (err) {
    return {
      success: false,
      message: `Codex config failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

function isCommandAvailable(command: string): boolean {
  try {
    const isWindows = process.platform === "win32";
    const checkCmd = isWindows ? `where ${command}` : `which ${command}`;
    execSync(checkCmd, { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

export function getToolNames(): ToolName[] {
  return ["claude", "opencode", "cursor", "windsurf", "codex", "zed"];
}
