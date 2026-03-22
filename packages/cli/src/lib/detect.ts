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
 * Strip JavaScript-style comments from JSON content.
 * Zed settings.json uses comments which are invalid plain JSON.
 */
function stripJsonComments(content: string): string {
  let result = "";
  let inString = false;
  let i = 0;

  while (i < content.length) {
    const char = content[i];

    // Toggle string state when we hit an unescaped quote
    if (char === '"' && (i === 0 || content[i - 1] !== "\\")) {
      inString = !inString;
      result += char;
      i++;
      continue;
    }

    // If we see // outside of a string, skip to end of line
    if (char === "/" && content[i + 1] === "/" && !inString) {
      while (i < content.length && content[i] !== "\n") {
        i++;
      }
      continue;
    }

    result += char;
    i++;
  }

  return result;
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
  const bridge = resolveMcpBridge();

  switch (tool) {
    case "claude":
      return configureClaudeCode(bridge);
    case "opencode":
      return configureOpenCode(join(projectDir, "opencode.json"), bridge);
    case "cursor":
      return configureMcpServersJson(
        "Cursor",
        join(projectDir, ".cursor", "mcp.json"),
        bridge,
      );
    case "windsurf":
      return configureMcpServersJson(
        "Windsurf",
        join(projectDir, ".windsurf", "mcp.json"),
        bridge,
      );
    case "codex":
      return configureCodex(bridge);
    case "zed":
      return configureZed(bridge);
    default:
      return { success: false, message: `Unknown tool: ${tool}` };
  }
}

/**
 * Resolves the global command to run the Orkestrate MCP bridge.
 */
function resolveMcpBridge(): { command: string; args: string[] } {
  return {
    command: "orkestrate",
    args: ["mcp"],
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
    // We pass the command and args as separate tokens
    const commandToRun = bridge.command;
    const argsToRun = bridge.args.join(" ");

    execSync(
      `claude mcp add --transport stdio --scope project Orkestrate ${commandToRun} ${argsToRun}`,
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

function configureZed(bridge: { command: string; args: string[] }): {
  success: boolean;
  message: string;
} {
  const configPath = getZedConfigPath();
  try {
    const dir = join(configPath, "..");
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    const rawContent = existsSync(configPath)
      ? readFileSync(configPath, "utf-8")
      : "{}";
    const strippedContent = stripJsonComments(rawContent);
    const config = JSON.parse(strippedContent);
    if (!config.context_servers || typeof config.context_servers !== "object")
      config.context_servers = {};

    // Zed format: command and args at top level, not nested
    config.context_servers["Orkestrate"] = {
      enabled: true,
      remote: false,
      command: bridge.command,
      args: bridge.args,
    };

    writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
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

function configureCodex(bridge: { command: string; args: string[] }): {
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
    const proxySection = `[mcp_servers.Orkestrate]\ncommand = "${bridge.command}"\nargs = [${bridge.args.map((a) => `"${a}"`).join(", ")}]\n`;

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
