#!/usr/bin/env node

// src/lib/config.ts
import Conf from "conf";
var config = new Conf({
  projectName: "orkestrate",
  projectSuffix: "",
  defaults: {
    credentials: null,
    activeWorkspaceId: null,
    activeWorkspaceName: null,
    serverUrl: "https://orkestrate.space"
  }
});
function getServerUrl() {
  return config.get("serverUrl");
}
function setCredentials(creds) {
  config.set("credentials", creds);
}
function getCredentials() {
  return config.get("credentials");
}

// src/lib/auth.ts
import { createHash, randomBytes } from "crypto";
import {
  createServer
} from "http";
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

// src/commands/mcp.ts
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

// src/mcp-entry.ts
mcpCommand().catch((err) => {
  process.stderr.write(`[Orkestrate-MCP] Fatal: ${err}
`);
  process.exit(1);
});
//# sourceMappingURL=mcp-entry.js.map