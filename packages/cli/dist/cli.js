#!/usr/bin/env node
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/lib/ui.ts
import pc from "picocolors";
var ui;
var init_ui = __esm({
  "src/lib/ui.ts"() {
    "use strict";
    ui = {
      // Status icons
      success: (msg) => console.log(`  ${pc.green("\u2713")} ${msg}`),
      error: (msg) => console.log(`  ${pc.red("\u2717")} ${msg}`),
      info: (msg) => console.log(`  ${pc.blue("\u2192")} ${msg}`),
      warn: (msg) => console.log(`  ${pc.yellow("!")} ${msg}`),
      dim: (msg) => console.log(`  ${pc.dim(msg)}`),
      // Headers
      header: (msg) => {
        console.log();
        console.log(`  ${pc.bold(pc.white(msg))}`);
        console.log();
      },
      // Blank line
      blank: () => console.log(),
      // Indented line
      line: (msg) => console.log(`  ${msg}`),
      // Key-value pair
      kv: (key, value) => {
        console.log(`  ${pc.dim(key + ":")} ${value}`);
      },
      // Table
      table: (headers, rows) => {
        const colWidths = headers.map((h, i) => {
          const maxContent = Math.max(h.length, ...rows.map((r) => (r[i] || "").length));
          return Math.min(maxContent, 40);
        });
        const separator = "\u2500";
        const pad = (s, w) => s.padEnd(w).slice(0, w);
        console.log(
          `  \u250C${colWidths.map((w) => separator.repeat(w + 2)).join("\u252C")}\u2510`
        );
        console.log(
          `  \u2502${headers.map((h, i) => ` ${pc.bold(pad(h, colWidths[i]))} `).join("\u2502")}\u2502`
        );
        console.log(
          `  \u251C${colWidths.map((w) => separator.repeat(w + 2)).join("\u253C")}\u2524`
        );
        for (const row of rows) {
          console.log(
            `  \u2502${row.map((c, i) => ` ${pad(c || "", colWidths[i])} `).join("\u2502")}\u2502`
          );
        }
        console.log(
          `  \u2514${colWidths.map((w) => separator.repeat(w + 2)).join("\u2534")}\u2518`
        );
      },
      // Colored status badge
      statusBadge: (status) => {
        switch (status) {
          case "active":
            return pc.green("\u25CF active");
          case "idle":
            return pc.dim("\u25CB idle");
          case "blocked":
            return pc.red("\u25A0 blocked");
          case "planning":
            return pc.blue("\u25C6 planning");
          case "handoff":
            return pc.yellow("\u21C4 handoff");
          case "done":
            return pc.dim("\u2713 done");
          default:
            return pc.dim(status);
        }
      },
      // Interactive prompts
      confirm: async (question, defaultYes = true) => {
        const { createInterface } = await import("readline/promises");
        const rl = createInterface({ input: process.stdin, output: process.stdout });
        const suffix = defaultYes ? "[Y/n]" : "[y/N]";
        const answer = await rl.question(`  ${pc.bold(pc.white(question))} ${pc.dim(suffix)} `);
        rl.close();
        if (!answer) return defaultYes;
        return answer.toLowerCase().startsWith("y");
      },
      input: async (question, defaultValue) => {
        const { createInterface } = await import("readline/promises");
        const rl = createInterface({ input: process.stdin, output: process.stdout });
        const suffix = defaultValue ? pc.dim(` (${defaultValue})`) : "";
        const answer = await rl.question(`  ${pc.bold(pc.white(question))}${suffix} `);
        rl.close();
        return answer || defaultValue || "";
      },
      // Banner
      banner: () => {
        console.log();
        console.log(pc.bold(pc.cyan("  \u2B21 orkestrate")));
        console.log(pc.dim("  the coordination layer for AI coding agents"));
        console.log();
      }
    };
  }
});

// src/lib/config.ts
import Conf from "conf";
function getServerUrl() {
  return config.get("serverUrl");
}
function setCredentials(creds) {
  config.set("credentials", creds);
}
function getCredentials() {
  return config.get("credentials");
}
function clearCredentials() {
  config.set("credentials", null);
}
function setActiveWorkspace(id, name) {
  config.set("activeWorkspaceId", id);
  config.set("activeWorkspaceName", name);
}
function getActiveWorkspace() {
  return {
    id: config.get("activeWorkspaceId"),
    name: config.get("activeWorkspaceName")
  };
}
function getConfigPath() {
  return config.path;
}
function setGithubTokens(tokens) {
  const creds = getCredentials();
  if (!creds) return;
  creds.githubAccessToken = tokens.accessToken;
  creds.githubRefreshToken = tokens.refreshToken;
  creds.githubExpiresAt = tokens.expiresAt;
  setCredentials(creds);
}
var config;
var init_config = __esm({
  "src/lib/config.ts"() {
    "use strict";
    config = new Conf({
      projectName: "orkestrate",
      projectSuffix: "",
      defaults: {
        credentials: null,
        activeWorkspaceId: null,
        activeWorkspaceName: null,
        serverUrl: "https://orkestrate.space"
      }
    });
  }
});

// src/lib/auth.ts
import { createHash, randomBytes } from "crypto";
import {
  createServer
} from "http";
function randomToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}
function pkceS256(verifier) {
  return createHash("sha256").update(verifier).digest("base64url");
}
async function registerClient(serverUrl, redirectUri) {
  const res = await fetch(`${serverUrl}/api/oauth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_name: "Orkestrate CLI",
      redirect_uris: [redirectUri],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none"
    })
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Client registration failed (${res.status}): ${body}`);
  }
  const data = await res.json();
  return { clientId: data.client_id };
}
function waitForCallback(port) {
  return new Promise((resolve, reject) => {
    let timeoutHandle;
    function cleanup() {
      clearTimeout(timeoutHandle);
      server.close();
    }
    const server = createServer((req, res) => {
      const url = new URL(req.url || "/", `http://localhost:${port}`);
      if (url.pathname !== "/callback") {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      const code = url.searchParams.get("code");
      const error = url.searchParams.get("error");
      const state = url.searchParams.get("state") || "";
      if (error) {
        const description = url.searchParams.get("error_description") || error;
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(buildErrorPage(description));
        cleanup();
        reject(new Error(`OAuth error: ${description}`));
        return;
      }
      if (!code) {
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end(buildErrorPage("No authorization code received."));
        cleanup();
        reject(new Error("No authorization code received"));
        return;
      }
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(buildSuccessPage());
      cleanup();
      resolve({ code, state });
    });
    server.listen(port, "127.0.0.1", () => {
    });
    server.on("error", (err) => {
      clearTimeout(timeoutHandle);
      reject(new Error(`Could not start local server: ${err.message}`));
    });
    timeoutHandle = setTimeout(
      () => {
        server.close();
        reject(
          new Error("Authentication timed out (5 minutes). Please try again.")
        );
      },
      5 * 60 * 1e3
    );
    timeoutHandle.unref();
  });
}
async function exchangeCodeForTokens(serverUrl, code, clientId, codeVerifier, redirectUri) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    code_verifier: codeVerifier,
    client_id: clientId,
    redirect_uri: redirectUri
  });
  const res = await fetch(`${serverUrl}/api/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString()
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed (${res.status}): ${text}`);
  }
  const data = await res.json();
  if (process.env.DEBUG) {
    console.error(
      `[DEBUG] Orkestrate Token: ${data.access_token?.slice(0, 5)}...`
    );
  }
  return data;
}
async function startGithubDeviceFlow(serverUrl, accessToken) {
  const res = await fetch(`${serverUrl}/api/oauth/github/auth-url`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    }
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Failed to start GitHub device flow (${res.status}): ${text}`
    );
  }
  return await res.json();
}
async function pollGithubToken(serverUrl, accessToken, userId, deviceCode, intervalSeconds) {
  const pollInterval = (intervalSeconds + 1) * 1e3;
  while (true) {
    await new Promise((resolve) => setTimeout(resolve, pollInterval));
    const res = await fetch(`${serverUrl}/api/oauth/github/token`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ device_code: deviceCode, user_id: userId })
    });
    const data = await res.json();
    if (data.error === "authorization_pending" || data.error === "slow_down") {
      continue;
    }
    if (data.error) {
      throw new Error(
        `GitHub authorization failed: ${data.error_description || data.error}`
      );
    }
    if (!data.access_token) {
      throw new Error("GitHub returned no access token");
    }
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in ?? 3600
    };
  }
}
async function refreshAccessToken() {
  const creds = getCredentials();
  if (!creds?.refreshToken) return null;
  const serverUrl = getServerUrl();
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: creds.refreshToken,
    client_id: creds.clientId
  });
  const res = await fetch(`${serverUrl}/api/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString()
  });
  if (!res.ok) return null;
  const tokens = await res.json();
  const now = Math.floor(Date.now() / 1e3);
  const newCreds = {
    clientId: creds.clientId,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: now + tokens.expires_in,
    userId: creds.userId,
    scope: tokens.scope,
    githubAccessToken: creds.githubAccessToken,
    githubRefreshToken: creds.githubRefreshToken,
    githubExpiresAt: creds.githubExpiresAt
  };
  setCredentials(newCreds);
  return newCreds;
}
async function getValidToken() {
  const creds = getCredentials();
  if (!creds) return null;
  const now = Math.floor(Date.now() / 1e3);
  if (creds.expiresAt <= now + 60) {
    const refreshed = await refreshAccessToken();
    return refreshed?.accessToken || null;
  }
  return creds.accessToken;
}
async function performLogin() {
  const serverUrl = getServerUrl();
  const port = 19274;
  const redirectUri = `http://127.0.0.1:${port}/callback`;
  const { clientId } = await registerClient(serverUrl, redirectUri);
  const codeVerifier = randomToken(48);
  const codeChallenge = pkceS256(codeVerifier);
  const state = randomToken(16);
  const authUrl = new URL(`${serverUrl}/api/oauth/authorize`);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("code_challenge", codeChallenge);
  authUrl.searchParams.set("code_challenge_method", "S256");
  authUrl.searchParams.set("scope", "openid profile email mcp:read mcp:write");
  authUrl.searchParams.set("state", state);
  const callbackPromise = waitForCallback(port);
  const { default: openBrowser } = await import("open");
  await openBrowser(authUrl.toString());
  const { code, state: returnedState } = await callbackPromise;
  if (returnedState !== state) {
    throw new Error(
      "Orkestrate OAuth state mismatch \u2014 possible CSRF attack. Aborting."
    );
  }
  const tokens = await exchangeCodeForTokens(
    serverUrl,
    code,
    clientId,
    codeVerifier,
    redirectUri
  );
  let userId = "";
  try {
    const meRes = await fetch(`${serverUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${tokens.access_token}` }
    });
    if (meRes.ok) {
      const me = await meRes.json();
      userId = me.id || "";
    }
  } catch {
  }
  const credentials = {
    clientId,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: Math.floor(Date.now() / 1e3) + tokens.expires_in,
    userId,
    scope: tokens.scope
  };
  setCredentials(credentials);
  let githubConnected = false;
  try {
    const deviceData = await startGithubDeviceFlow(
      serverUrl,
      tokens.access_token
    );
    console.error();
    console.error("  GitHub Device Authorization");
    console.error();
    console.error(`  1. Open:   ${deviceData.verification_uri}`);
    console.error(`  2. Enter:  ${deviceData.user_code}`);
    console.error();
    console.error("  Waiting for authorization... (press Ctrl+C to cancel)");
    const githubTokens = await pollGithubToken(
      serverUrl,
      tokens.access_token,
      userId,
      deviceData.device_code,
      deviceData.interval
    );
    setGithubTokens({
      accessToken: githubTokens.access_token,
      refreshToken: githubTokens.refresh_token,
      expiresAt: Math.floor(Date.now() / 1e3) + (githubTokens.expires_in ?? 3600)
    });
    githubConnected = true;
  } catch (err) {
    console.error(
      `[Login] GitHub connection failed: ${err instanceof Error ? err.message : String(err)}`
    );
    console.error("[Login] Workspace creation requires GitHub access.");
    console.error(
      "[Login] Re-run `orkestrate login --github` to connect GitHub later."
    );
  }
  return {
    clientId,
    userId: credentials.userId,
    accessToken: credentials.accessToken,
    githubConnected
  };
}
function buildSuccessPage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Orkestrate \u2014 Authenticated</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0a0a0a;
      color: #e5e5e5;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }
    .card {
      text-align: center;
      padding: 3rem;
      border: 1px solid #262626;
      border-radius: 12px;
      background: #111;
      max-width: 420px;
    }
    .icon { font-size: 3rem; margin-bottom: 1rem; }
    h1 { font-size: 1.5rem; margin-bottom: 0.5rem; color: #fff; }
    p { color: #a3a3a3; line-height: 1.6; }
    .hint { margin-top: 1.5rem; font-size: 0.85rem; color: #525252; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">\u2713</div>
    <h1>Authenticated</h1>
    <p>You're now logged in to Orkestrate. You can close this tab and return to your terminal.</p>
    <p class="hint">This window will close automatically.</p>
  </div>
  <script>setTimeout(() => window.close(), 3000);</script>
</body>
</html>`;
}
function buildErrorPage(message) {
  const escaped = message.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Orkestrate \u2014 Error</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0a0a0a;
      color: #e5e5e5;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }
    .card {
      text-align: center;
      padding: 3rem;
      border: 1px solid #371717;
      border-radius: 12px;
      background: #1a0a0a;
      max-width: 420px;
    }
    .icon { font-size: 3rem; margin-bottom: 1rem; }
    h1 { font-size: 1.5rem; margin-bottom: 0.5rem; color: #fca5a5; }
    p { color: #a3a3a3; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">\u2717</div>
    <h1>Authentication Failed</h1>
    <p>${escaped}</p>
  </div>
</body>
</html>`;
}
var init_auth = __esm({
  "src/lib/auth.ts"() {
    "use strict";
    init_config();
  }
});

// src/commands/login.ts
var login_exports = {};
__export(login_exports, {
  loginCommand: () => loginCommand
});
async function loginCommand() {
  const existing = getCredentials();
  if (existing?.accessToken) {
    ui.dim("Refreshing existing session...");
  }
  ui.info("Opening browser for Orkestrate authentication...");
  ui.blank();
  try {
    const result = await performLogin();
    ui.blank();
    ui.success("Logged in to Orkestrate!");
    if (result.githubConnected) {
      ui.success("GitHub connected.");
    } else {
      ui.warn(
        "GitHub not connected \u2014 workspace creation will require GitHub access."
      );
    }
    ui.blank();
    ui.info("Next steps:");
    ui.line(
      "  1. orkestrate init              \u2014 link your project to a workspace"
    );
    ui.line(
      "  2. orkestrate connect <tool>      \u2014 configure your AI tool (claude, opencode, etc.)"
    );
    ui.line(
      "  3. Run your AI tool               \u2014 your agent starts and joins the workspace"
    );
    ui.line("  4. In your AI tool, call: join_workspace <workspace_id>");
    ui.blank();
    ui.dim(`Credentials stored at: ${getConfigPath()}`);
  } catch (err) {
    ui.error(
      `Login failed: ${err instanceof Error ? err.message : String(err)}`
    );
    process.exit(1);
  }
}
var init_login = __esm({
  "src/commands/login.ts"() {
    "use strict";
    init_auth();
    init_config();
    init_ui();
  }
});

// src/commands/logout.ts
var logout_exports = {};
__export(logout_exports, {
  logoutCommand: () => logoutCommand
});
function logoutCommand() {
  const existing = getCredentials();
  if (!existing?.accessToken) {
    ui.dim("Not currently logged in.");
    return;
  }
  clearCredentials();
  ui.success("Logged out. Credentials cleared.");
  ui.dim(`Config: ${getConfigPath()}`);
}
var init_logout = __esm({
  "src/commands/logout.ts"() {
    "use strict";
    init_config();
    init_ui();
  }
});

// src/lib/detect.ts
var detect_exports = {};
__export(detect_exports, {
  configureTool: () => configureTool,
  detectTools: () => detectTools,
  getToolNames: () => getToolNames
});
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { execSync } from "child_process";
function detectTools(projectDir = process.cwd()) {
  const tools = [];
  tools.push({
    name: "claude",
    displayName: "Claude Code",
    detected: isCommandAvailable("claude")
  });
  const opencodeConfig = join(projectDir, "opencode.json");
  tools.push({
    name: "opencode",
    displayName: "OpenCode",
    detected: existsSync(opencodeConfig) || isCommandAvailable("opencode"),
    configPath: opencodeConfig
  });
  const cursorConfig = join(projectDir, ".cursor", "mcp.json");
  tools.push({
    name: "cursor",
    displayName: "Cursor",
    detected: existsSync(join(projectDir, ".cursor")) || existsSync(cursorConfig),
    configPath: cursorConfig
  });
  const windsurfConfig = join(projectDir, ".windsurf", "mcp.json");
  tools.push({
    name: "windsurf",
    displayName: "Windsurf",
    detected: existsSync(join(projectDir, ".windsurf")) || existsSync(windsurfConfig),
    configPath: windsurfConfig
  });
  const codexDir = join(homedir(), ".codex");
  tools.push({
    name: "codex",
    displayName: "Codex CLI",
    detected: isCommandAvailable("codex") || existsSync(codexDir)
  });
  return tools;
}
async function configureTool(tool, projectDir = process.cwd()) {
  const bridge = resolveMcpBridge();
  const mcpUrl = `${getServerUrl()}/api/mcp`;
  switch (tool) {
    case "claude":
      return configureClaudeCode(bridge);
    case "opencode":
      return configureOpenCode(join(projectDir, "opencode.json"), bridge);
    case "cursor":
      return configureMcpServersJson("Cursor", join(projectDir, ".cursor", "mcp.json"), bridge);
    case "windsurf":
      return configureMcpServersJson("Windsurf", join(projectDir, ".windsurf", "mcp.json"), bridge);
    case "codex":
      return configureCodex(bridge);
    default:
      return { success: false, message: `Unknown tool: ${tool}` };
  }
}
function resolveMcpBridge() {
  return {
    command: "orkestrate",
    args: ["mcp"]
  };
}
function configureClaudeCode(bridge) {
  if (!isCommandAvailable("claude")) return { success: false, message: "Claude Code CLI not found." };
  try {
    try {
      execSync("claude mcp remove Orkestrate", { stdio: "pipe" });
    } catch {
    }
    const commandToRun = bridge.command;
    const argsToRun = bridge.args.join(" ");
    execSync(
      `claude mcp add --transport stdio --scope project Orkestrate ${commandToRun} ${argsToRun}`,
      { stdio: "pipe", encoding: "utf-8" }
    );
    return { success: true, message: "MCP added to Claude Code." };
  } catch (err) {
    return { success: false, message: `Claude config failed: ${err instanceof Error ? err.message : String(err)}` };
  }
}
function configureOpenCode(configPath, bridge) {
  try {
    let config2 = existsSync(configPath) ? JSON.parse(readFileSync(configPath, "utf-8")) : {};
    if (!config2.mcp || typeof config2.mcp !== "object") config2.mcp = {};
    config2.mcp["Orkestrate"] = {
      type: "local",
      command: [bridge.command, ...bridge.args],
      enabled: true
    };
    writeFileSync(configPath, JSON.stringify(config2, null, 2) + "\n", "utf-8");
    return { success: true, message: `Configured OpenCode at ${configPath}` };
  } catch (err) {
    return { success: false, message: `OpenCode config failed: ${err instanceof Error ? err.message : String(err)}` };
  }
}
function configureMcpServersJson(displayName, configPath, bridge) {
  try {
    const dir = join(configPath, "..");
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    let config2 = existsSync(configPath) ? JSON.parse(readFileSync(configPath, "utf-8")) : {};
    if (!config2.mcpServers || typeof config2.mcpServers !== "object") config2.mcpServers = {};
    config2.mcpServers["Orkestrate"] = {
      command: bridge.command,
      args: bridge.args
    };
    writeFileSync(configPath, JSON.stringify(config2, null, 2) + "\n", "utf-8");
    return { success: true, message: `Configured ${displayName} at ${configPath}` };
  } catch (err) {
    return { success: false, message: `${displayName} config failed: ${err instanceof Error ? err.message : String(err)}` };
  }
}
function configureCodex(bridge) {
  const home = homedir();
  const codexDir = join(home, ".codex");
  const configPath = join(codexDir, "config.toml");
  try {
    if (!existsSync(codexDir)) mkdirSync(codexDir, { recursive: true });
    let content = existsSync(configPath) ? readFileSync(configPath, "utf-8") : "[mcp_servers]\n";
    const proxySection = `[mcp_servers.Orkestrate]
command = "${bridge.command}"
args = [${bridge.args.map((a) => `"${a}"`).join(", ")}]
`;
    const sectionRegex = /\[mcp_servers\.Orkestrate\]\s*\n(?:(?!\[)[^\n]*\n?)*/;
    if (sectionRegex.test(content)) {
      content = content.replace(sectionRegex, proxySection);
    } else {
      const mcpServersIdx = content.indexOf("[mcp_servers]");
      if (mcpServersIdx !== -1) {
        const lineEnd = content.indexOf("\n", mcpServersIdx);
        const insertPos = lineEnd !== -1 ? lineEnd + 1 : content.length;
        content = content.slice(0, insertPos) + "\n" + proxySection + content.slice(insertPos);
      } else {
        content = content.trimEnd() + "\n\n[mcp_servers]\n\n" + proxySection;
      }
    }
    writeFileSync(configPath, content, "utf-8");
    return { success: true, message: `Configured Codex.` };
  } catch (err) {
    return { success: false, message: `Codex config failed: ${err instanceof Error ? err.message : String(err)}` };
  }
}
function isCommandAvailable(command) {
  try {
    const isWindows = process.platform === "win32";
    const checkCmd = isWindows ? `where ${command}` : `which ${command}`;
    execSync(checkCmd, { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}
function getToolNames() {
  return ["claude", "opencode", "cursor", "windsurf", "codex"];
}
var init_detect = __esm({
  "src/lib/detect.ts"() {
    "use strict";
    init_config();
  }
});

// src/commands/connect.ts
var connect_exports = {};
__export(connect_exports, {
  connectCommand: () => connectCommand
});
async function connectCommand(toolName) {
  const creds = getCredentials();
  if (!creds?.accessToken) {
    ui.error("Not authenticated. Run `orkestrate login` first.");
    process.exit(1);
  }
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
  const normalized = toolName.toLowerCase().trim();
  const isAutoConfig = SUPPORTED_AUTO_CONFIG.includes(normalized);
  if (!isAutoConfig) {
    ui.header(`Connect ${normalized} to Orkestrate`);
    ui.blank();
    ui.info("Orkestrate MCP endpoint:");
    ui.line(`  ${getServerUrl()}/api/mcp`);
    ui.blank();
    displayGenericInstructions();
    ui.blank();
    ui.info(
      `To configure ${normalized} with Orkestrate MCP, add it as a stdio MCP server.`
    );
    ui.dim(
      `Restart ${normalized} after configuring MCP for changes to take effect.`
    );
    return;
  }
  ui.info(`Configuring Orkestrate MCP for ${toolName}...`);
  const result = await configureTool(normalized);
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
function displayGenericInstructions() {
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
    `    claude mcp add --transport stdio Orkestrate ${bridgeCommand} ${bridgeArgs}`
  );
  ui.blank();
  ui.line("  Cursor:");
  ui.line("    Settings \u2192 MCP \u2192 Add new server:");
  ui.line(`      Name: Orkestrate`);
  ui.line(`      Command: ${bridgeCommand}`);
  ui.line(`      Args: ${bridgeArgs}`);
  ui.blank();
  ui.line("  Windsurf:");
  ui.line("    Settings \u2192 MCP \u2192 Add server:");
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
    "  Not sure if your tool supports MCP? Check its docs for 'MCP server'."
  );
}
var SUPPORTED_AUTO_CONFIG;
var init_connect = __esm({
  "src/commands/connect.ts"() {
    "use strict";
    init_config();
    init_detect();
    init_ui();
    SUPPORTED_AUTO_CONFIG = [
      "claude",
      "opencode",
      "cursor",
      "windsurf",
      "codex"
    ];
  }
});

// src/lib/api.ts
var api_exports = {};
__export(api_exports, {
  ApiError: () => ApiError,
  checkHealth: () => checkHealth,
  createWorkspace: () => createWorkspace,
  getMe: () => getMe,
  getTeamStatus: () => getTeamStatus,
  listWorkspaces: () => listWorkspaces,
  switchWorkspace: () => switchWorkspace
});
async function authHeaders() {
  const token = await getValidToken();
  if (!token) {
    throw new ApiError(401, "Not authenticated. Run `orkestrate login` first.");
  }
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json"
  };
}
async function request(method, path, body) {
  const serverUrl = getServerUrl();
  const headers = await authHeaders();
  const token = headers["Authorization"]?.split(" ")[1] || "";
  const maskedToken = token.length > 10 ? `${token.slice(0, 5)}...${token.slice(-5)}` : "***";
  if (process.env.DEBUG) {
    console.error(`[DEBUG] API Request: ${method} ${serverUrl}${path}`);
    console.error(`[DEBUG] Token: ${maskedToken} (len: ${token.length})`);
  }
  const res = await fetch(`${serverUrl}${path}`, {
    method,
    headers: {
      ...headers,
      "Accept": "application/json",
      "User-Agent": "Orkestrate-CLI-v1"
    },
    body: body ? JSON.stringify(body) : void 0
  });
  if (!res.ok) {
    const text = await res.text();
    throw new ApiError(res.status, `API error (${res.status}): ${text}`);
  }
  return await res.json();
}
async function getMe() {
  const data = await request("GET", "/api/auth/me");
  return data.user;
}
async function listWorkspaces() {
  const data = await request("GET", "/api/workspaces");
  return data.workspaces || [];
}
async function switchWorkspace(workspaceId) {
  await request("POST", "/api/workspaces", {
    action: "switch",
    workspaceId
  });
}
async function createWorkspace(name, repoUrl, defaultBranch) {
  const data = await request("POST", "/api/workspaces", {
    action: "create",
    name,
    repoUrl,
    defaultBranch
  });
  return data.workspace;
}
async function getTeamStatus() {
  const serverUrl = getServerUrl();
  const token = await getValidToken();
  if (!token) {
    throw new ApiError(401, "Not authenticated. Run `orkestrate login` first.");
  }
  const res = await fetch(`${serverUrl}/api/mcp`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: "read_team_state",
        arguments: {}
      }
    })
  });
  if (!res.ok) {
    const text = await res.text();
    throw new ApiError(res.status, `MCP error (${res.status}): ${text}`);
  }
  const rpcResult = await res.json();
  if (rpcResult.error) {
    throw new ApiError(400, rpcResult.error.message || "MCP call failed");
  }
  const content = rpcResult.result?.content || [];
  const textContent = content.filter((c) => c.type === "text").map((c) => c.text).join("\n");
  try {
    const parsed = JSON.parse(textContent);
    return {
      agents: parsed.agents || parsed.states || [],
      stateHash: parsed.stateHash || ""
    };
  } catch {
    return { agents: [], stateHash: "" };
  }
}
async function checkHealth() {
  const serverUrl = getServerUrl();
  try {
    const res = await fetch(`${serverUrl}/api/health`, { method: "GET" });
    return res.ok;
  } catch {
    return false;
  }
}
var ApiError;
var init_api = __esm({
  "src/lib/api.ts"() {
    "use strict";
    init_config();
    init_auth();
    ApiError = class extends Error {
      constructor(status, message) {
        super(message);
        this.status = status;
        this.name = "ApiError";
      }
    };
  }
});

// src/commands/status.ts
var status_exports = {};
__export(status_exports, {
  statusCommand: () => statusCommand
});
async function statusCommand() {
  const creds = getCredentials();
  if (!creds?.accessToken) {
    ui.error("Not authenticated. Run `orkestrate login` first.");
    process.exit(1);
  }
  const healthy = await checkHealth();
  if (!healthy) {
    ui.error("Cannot reach Orkestrate server. Check your connection.");
    process.exit(1);
  }
  const workspace = getActiveWorkspace();
  ui.header("Orkestrate Status");
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
    const rows = agents.map((agent) => [
      agent.agentId || agent.scopedAgentId,
      agent.toolName || "\u2014",
      agent.status,
      truncate(agent.objective, 35)
    ]);
    ui.table(
      ["Agent", "Tool", "Status", "Objective"],
      rows
    );
    const agentsWithClaims = agents.filter(
      (a) => a.claimedPaths && a.claimedPaths.length > 0
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
      `Failed to fetch status: ${err instanceof Error ? err.message : String(err)}`
    );
    process.exit(1);
  }
}
function truncate(s, max) {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "\u2026";
}
function pc_bold(s) {
  return `\x1B[1m${s}\x1B[22m`;
}
var init_status = __esm({
  "src/commands/status.ts"() {
    "use strict";
    init_config();
    init_api();
    init_ui();
  }
});

// src/commands/workspace.ts
var workspace_exports = {};
__export(workspace_exports, {
  workspaceCommand: () => workspaceCommand
});
async function workspaceCommand(action, nameOrId, extra) {
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
      ui.line("  list     \u2014 Show all workspaces");
      ui.line("  switch   \u2014 Switch active workspace");
      ui.line("  create   \u2014 Create a new workspace");
      process.exit(1);
  }
}
async function workspaceList() {
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
      const marker = isActive ? " \u2190 active" : "";
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
async function workspaceSwitch(nameOrId) {
  try {
    const workspaces = await listWorkspaces();
    const target = workspaces.find(
      (ws) => ws.id === nameOrId || ws.name.toLowerCase() === nameOrId.toLowerCase()
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
    await switchWorkspace(target.id);
    setActiveWorkspace(target.id, target.name);
    ui.success(`Switched to workspace: ${target.name}`);
  } catch (err) {
    ui.error(`Failed to switch workspace: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}
async function workspaceCreate(name, repoUrl) {
  if (!repoUrl) {
    ui.error("Repository URL is required.");
    ui.info("Usage: orkestrate workspace create <name> <repo-url>");
    process.exit(1);
  }
  try {
    const workspace = await createWorkspace(name, repoUrl, "main");
    setActiveWorkspace(workspace.id, workspace.name || name);
    ui.success(`Created workspace: ${workspace.name || name}`);
    ui.kv("ID", workspace.id);
    ui.kv("Repo", repoUrl);
  } catch (err) {
    ui.error(`Failed to create workspace: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}
var init_workspace = __esm({
  "src/commands/workspace.ts"() {
    "use strict";
    init_config();
    init_api();
    init_ui();
  }
});

// src/lib/git.ts
import { execSync as execSync2 } from "child_process";
function git(cmd, cwd) {
  try {
    return execSync2(`git ${cmd}`, {
      cwd,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"]
    }).trim();
  } catch {
    return "";
  }
}
function detectGitContext(cwd = process.cwd()) {
  const repoRoot = git("rev-parse --show-toplevel", cwd);
  if (!repoRoot) return null;
  const remote = git("remote get-url origin", cwd);
  const branch = git("rev-parse --abbrev-ref HEAD", cwd);
  const headSha = git("rev-parse HEAD", cwd);
  const status = git("status --porcelain", cwd);
  return {
    remote: remote || "",
    repoRoot,
    branch: branch || "unknown",
    headSha: headSha || "",
    dirty: status.length > 0,
    collectedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}
var init_git = __esm({
  "src/lib/git.ts"() {
    "use strict";
  }
});

// src/commands/init.ts
var init_exports = {};
__export(init_exports, {
  initCommand: () => initCommand
});
import { existsSync as existsSync2, writeFileSync as writeFileSync2 } from "fs";
import { join as join2 } from "path";
async function initCommand() {
  const creds = getCredentials();
  if (!creds?.accessToken) {
    ui.error("Not authenticated. Run `orkestrate login` first.");
    process.exit(1);
  }
  const cwd = process.cwd();
  ui.header("Initializing Orkestrate");
  const git2 = detectGitContext(cwd);
  if (git2) {
    ui.success(`Git repository detected`);
    ui.kv("Remote", git2.remote || "(no remote)");
    ui.kv("Branch", git2.branch);
    ui.kv("HEAD", git2.headSha.slice(0, 8));
    ui.kv("Dirty", git2.dirty ? "yes" : "clean");
  } else {
    ui.warn("No git repository detected in current directory.");
    ui.dim("Orkestrate works best with a git repository.");
  }
  ui.blank();
  try {
    const workspaces = await listWorkspaces();
    let matched = false;
    if (git2?.remote && workspaces.length > 0) {
      const normalizedRemote = normalizeGitUrl(git2.remote);
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
      if (git2?.remote) {
        const create = await ui.confirm(`No matching workspace found for this repository. Create one?`);
        if (create) {
          const name = await ui.input("Workspace name", git2.remote.split("/").pop()?.replace(/\.git$/, ""));
          try {
            const { createWorkspace: createWorkspace2 } = await Promise.resolve().then(() => (init_api(), api_exports));
            const workspace = await createWorkspace2(name, git2.remote, git2.branch || "main");
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
            ui.line(`  \u2022 ${ws.name} (${ws.id})`);
          }
          const wsId = await ui.input("Enter workspace ID to link (or leave blank)");
          if (wsId) {
            const selected = workspaces.find((w) => w.id === wsId || w.name === wsId);
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
  const tools = detectTools(cwd);
  const found = tools.filter((t) => t.detected);
  if (found.length > 0) {
    ui.info("Detected AI tools:");
    for (const tool of found) {
      ui.line(`  \u2022 ${tool.displayName}`);
    }
    ui.blank();
    const connect = await ui.confirm(`Would you like to connect ${found[0].displayName} now?`);
    if (connect) {
      const { configureTool: configureTool2 } = await Promise.resolve().then(() => (init_detect(), detect_exports));
      const res = await configureTool2(found[0].name, cwd);
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
  const configFile = join2(cwd, ".orkestrate.json");
  const activeWs = getActiveWorkspace();
  if (!existsSync2(configFile)) {
    if (activeWs.id) {
      const projectConfig = {
        $schema: "https://orkestrate.space/schema/project.json",
        workspaceId: activeWs.id,
        server: "https://orkestrate.space",
        initialized: (/* @__PURE__ */ new Date()).toISOString()
      };
      writeFileSync2(configFile, JSON.stringify(projectConfig, null, 2) + "\n", "utf-8");
      ui.blank();
      ui.success(`Created .orkestrate.json`);
      ui.dim("This file identifies your project workspace. It is gitignored by default.");
    }
  } else {
    try {
      const { readFileSync: readFileSync2 } = await import("fs");
      const existing = JSON.parse(readFileSync2(configFile, "utf-8"));
      if (activeWs.id && existing.workspaceId !== activeWs.id) {
        existing.workspaceId = activeWs.id;
        writeFileSync2(configFile, JSON.stringify(existing, null, 2) + "\n", "utf-8");
        ui.success(`Updated .orkestrate.json with workspace ID ${activeWs.id}`);
      }
    } catch {
    }
  }
  ui.blank();
}
function normalizeGitUrl(url) {
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
var init_init = __esm({
  "src/commands/init.ts"() {
    "use strict";
    init_config();
    init_git();
    init_api();
    init_detect();
    init_ui();
  }
});

// src/commands/mcp.ts
var mcp_exports = {};
__export(mcp_exports, {
  mcpCommand: () => mcpCommand
});
async function mcpCommand() {
  try {
    const serverUrl = getServerUrl();
    const mcpUrl = `${serverUrl}/api/mcp`;
    process.stdin.setEncoding("utf-8");
    let buffer = "";
    process.stderr.write(`[Orkestrate-MCP] Starting bridge to ${mcpUrl}
`);
    process.stdin.on("data", async (chunk) => {
      const rawChunk = String(chunk);
      if (process.env.DEBUG) process.stderr.write(`[Orkestrate-MCP] Received chunk: ${rawChunk}
`);
      buffer += rawChunk;
      let lineEndIndex;
      while ((lineEndIndex = buffer.indexOf("\n")) >= 0) {
        let line = buffer.slice(0, lineEndIndex).trim();
        buffer = buffer.slice(lineEndIndex + 1);
        if (!line) continue;
        if (line.includes("}{")) {
          const parts = line.split("}{");
          await processLine(parts[0] + "}", mcpUrl);
          for (let i = 1; i < parts.length - 1; i++) {
            await processLine("{" + parts[i] + "}", mcpUrl);
          }
          await processLine("{" + parts[parts.length - 1], mcpUrl);
        } else {
          await processLine(line, mcpUrl);
        }
      }
    });
    process.stdin.on("end", async () => {
      await new Promise((r) => setTimeout(r, 100));
      process.exit(0);
    });
    await new Promise(() => {
    });
  } catch (err) {
    process.stderr.write(`[Orkestrate] Fatal error: ${err}
`);
    process.exit(1);
  }
}
async function processLine(line, mcpUrl) {
  if (process.env.DEBUG) process.stderr.write(`[Orkestrate-MCP] Processing line: ${line}
`);
  let payload;
  try {
    payload = JSON.parse(line);
  } catch {
    if (process.env.DEBUG) process.stderr.write(`[Orkestrate-MCP] JSON Parse failed for: ${line}
`);
    return;
  }
  const isNotification = !Object.prototype.hasOwnProperty.call(payload, "id");
  const requestId = payload.id;
  try {
    const token = await getValidToken();
    if (!token) {
      throw new Error("NOT_LOGGED_IN: Please run 'orkestrate login' to authenticate.");
    }
    const res = await fetch(mcpUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
        "User-Agent": "Orkestrate-CLI-Proxy"
      },
      body: line
    });
    if (isNotification) return;
    const responseBody = await res.text();
    if (!res.ok) {
      process.stderr.write(`[Orkestrate-MCP] Backend error (${res.status}): ${responseBody}
`);
      if (!isNotification) {
        process.stdout.write(JSON.stringify({
          jsonrpc: "2.0",
          id: requestId,
          error: {
            code: -32603,
            message: `Orkestrate Cloud Error (${res.status}): ${responseBody || "Unauthorized"}. Please try 'orkestrate login'.`
          }
        }) + "\n");
      }
      return;
    }
    if (responseBody) {
      process.stdout.write(responseBody + "\n");
    }
  } catch (err) {
    if (isNotification) return;
    process.stdout.write(JSON.stringify({
      jsonrpc: "2.0",
      id: requestId,
      error: {
        code: -32603,
        message: err instanceof Error ? err.message : String(err)
      }
    }) + "\n");
  }
}
var init_mcp = __esm({
  "src/commands/mcp.ts"() {
    "use strict";
    init_config();
    init_auth();
  }
});

// src/commands/whoami.ts
var whoami_exports = {};
__export(whoami_exports, {
  whoamiCommand: () => whoamiCommand
});
async function whoamiCommand() {
  ui.header("Orkestrate Configuration");
  const creds = getCredentials();
  const workspace = getActiveWorkspace();
  const serverUrl = getServerUrl();
  ui.kv("Server", serverUrl);
  ui.kv("Config", getConfigPath());
  ui.blank();
  if (creds?.accessToken) {
    ui.success("Authenticated");
    try {
      const { getMe: getMe2 } = await Promise.resolve().then(() => (init_api(), api_exports));
      const user = await getMe2();
      ui.kv("User", user.email);
      ui.kv("User ID", user.id);
    } catch {
      ui.kv("Client ID", creds.clientId);
      ui.dim("Could not fetch user info from server.");
    }
    const expiresIn = creds.expiresAt - Math.floor(Date.now() / 1e3);
    if (expiresIn > 0) {
      const minutes = Math.floor(expiresIn / 60);
      ui.kv("Token expires", `in ${minutes} minute(s)`);
    } else {
      ui.warn("Access token expired \u2014 will auto-refresh on next API call.");
    }
  } else {
    ui.error("Not authenticated. Run `orkestrate login`.");
  }
  ui.blank();
  if (workspace.id) {
    ui.kv("Active workspace", workspace.name || "\u2014");
    ui.kv("Workspace ID", workspace.id);
  } else {
    ui.dim("No active workspace set.");
  }
  ui.blank();
  ui.info("Checking server health...");
  const healthy = await checkHealth();
  if (healthy) {
    ui.success("Server is reachable");
  } else {
    ui.error("Server is unreachable");
  }
}
var init_whoami = __esm({
  "src/commands/whoami.ts"() {
    "use strict";
    init_config();
    init_api();
    init_ui();
  }
});

// src/cli.ts
init_ui();
import { Command } from "commander";
var program = new Command();
program.name("orkestrate").description("The coordination layer for autonomous AI coding agents").version("0.1.14").hook("preAction", () => {
});
program.command("login").description("Authenticate with Orkestrate via browser OAuth").action(async () => {
  const { loginCommand: loginCommand2 } = await Promise.resolve().then(() => (init_login(), login_exports));
  await loginCommand2();
});
program.command("logout").description("Clear stored credentials").action(async () => {
  const { logoutCommand: logoutCommand2 } = await Promise.resolve().then(() => (init_logout(), logout_exports));
  logoutCommand2();
});
program.command("connect [tool]").description(
  "Configure MCP endpoint for an AI coding tool (claude, opencode, cursor, windsurf, codex)"
).action(async (tool) => {
  const { connectCommand: connectCommand2 } = await Promise.resolve().then(() => (init_connect(), connect_exports));
  await connectCommand2(tool);
});
program.command("status").alias("s").description("Show current team coordination state").action(async () => {
  const { statusCommand: statusCommand2 } = await Promise.resolve().then(() => (init_status(), status_exports));
  await statusCommand2();
});
program.command("workspace [action] [name] [extra]").alias("ws").description("Manage workspaces (list, switch, create)").action(async (action, name, extra) => {
  const { workspaceCommand: workspaceCommand2 } = await Promise.resolve().then(() => (init_workspace(), workspace_exports));
  await workspaceCommand2(action, name, extra);
});
program.command("init").description("Initialize Orkestrate in the current project").action(async () => {
  const { initCommand: initCommand2 } = await Promise.resolve().then(() => (init_init(), init_exports));
  await initCommand2();
});
program.command("mcp").description("Run as a local MCP server (stdio bridge to Orkestrate Cloud)").action(async () => {
  try {
    const { mcpCommand: mcpCommand2 } = await Promise.resolve().then(() => (init_mcp(), mcp_exports));
    await mcpCommand2();
  } catch (err) {
    process.stderr.write(
      `[Orkestrate-MCP] ${err instanceof Error ? err.message : String(err)}
`
    );
    process.exit(1);
  }
});
program.command("whoami").description("Show current authentication and configuration").action(async () => {
  const { whoamiCommand: whoamiCommand2 } = await Promise.resolve().then(() => (init_whoami(), whoami_exports));
  await whoamiCommand2();
});
program.action(() => {
  ui.banner();
  program.help();
});
program.parseAsync(process.argv).catch((err) => {
  ui.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
//# sourceMappingURL=cli.js.map