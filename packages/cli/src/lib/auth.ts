/**
 * Orkestrate CLI — OAuth Authentication
 *
 * Implements OAuth 2.0 + PKCE flow with two providers:
 * 1. Orkestrate OAuth — identity (openid, profile, email, mcp scopes)
 * 2. GitHub OAuth — repo access (required for workspace creation)
 *
 * Flow:
 * 1. Orkestrate OAuth → Orkestrate identity tokens
 * 2. GitHub OAuth (via Orkestrate proxy) → GitHub access tokens
 * 3. Both stored locally in ~/.config/orkestrate/
 */

import { createHash, randomBytes } from "node:crypto";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import {
  getServerUrl,
  setCredentials,
  getCredentials,
  setGithubTokens,
  type StoredCredentials,
} from "./config.js";

// ─── PKCE Helpers ──────────────────────────────────────────────────────────────

function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

function pkceS256(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

// ─── Token Types ───────────────────────────────────────────────────────────────

interface TokenResponse {
  token_type: string;
  access_token: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
  id_token?: string;
}

// ─── Dynamic Client Registration ───────────────────────────────────────────────

async function registerClient(
  serverUrl: string,
  redirectUri: string,
): Promise<{ clientId: string }> {
  const res = await fetch(`${serverUrl}/api/oauth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_name: "Orkestrate CLI",
      redirect_uris: [redirectUri],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Client registration failed (${res.status}): ${body}`);
  }

  const data = (await res.json()) as { client_id: string };
  return { clientId: data.client_id };
}

// ─── Callback Server ───────────────────────────────────────────────────────────

function waitForCallback(
  port: number,
): Promise<{ code: string; state: string }> {
  return new Promise((resolve, reject) => {
    let timeoutHandle: ReturnType<typeof setTimeout>;

    function cleanup() {
      clearTimeout(timeoutHandle);
      server.close();
    }

    const server = createServer((req: IncomingMessage, res: ServerResponse) => {
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
      // ready
    });

    server.on("error", (err: Error) => {
      clearTimeout(timeoutHandle);
      reject(new Error(`Could not start local server: ${err.message}`));
    });

    // 5-minute timeout — unref so it doesn't block process exit
    timeoutHandle = setTimeout(
      () => {
        server.close();
        reject(
          new Error("Authentication timed out (5 minutes). Please try again."),
        );
      },
      5 * 60 * 1000,
    );
    timeoutHandle.unref();
  });
}

// ─── Token Exchange ────────────────────────────────────────────────────────────

async function exchangeCodeForTokens(
  serverUrl: string,
  code: string,
  clientId: string,
  codeVerifier: string,
  redirectUri: string,
): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    code_verifier: codeVerifier,
    client_id: clientId,
    redirect_uri: redirectUri,
  });

  const res = await fetch(`${serverUrl}/api/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as TokenResponse;
  if (process.env.DEBUG) {
    console.error(
      `[DEBUG] Orkestrate Token: ${data.access_token?.slice(0, 5)}...`,
    );
  }
  return data;
}

// ─── GitHub OAuth (proxied through Orkestrate backend, device flow) ────────────

interface GithubDeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

interface GithubTokenPollResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

/**
 * Start GitHub's Device Flow via Orkestrate proxy.
 * Returns device code + user code for the user to enter at verification_uri.
 */
async function startGithubDeviceFlow(
  serverUrl: string,
  accessToken: string,
): Promise<GithubDeviceCodeResponse> {
  const res = await fetch(`${serverUrl}/api/oauth/github/auth-url`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Failed to start GitHub device flow (${res.status}): ${text}`,
    );
  }

  return (await res.json()) as GithubDeviceCodeResponse;
}

/**
 * Poll Orkestrate (which proxies to GitHub) for the GitHub token.
 * Returns null while authorization is still pending.
 * Throws on error or expired code.
 */
async function pollGithubToken(
  serverUrl: string,
  accessToken: string,
  userId: string,
  deviceCode: string,
  intervalSeconds: number,
): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}> {
  // Add a small buffer to the interval to avoid hitting rate limits
  const pollInterval = (intervalSeconds + 1) * 1000;

  while (true) {
    await new Promise((resolve) => setTimeout(resolve, pollInterval));

    const res = await fetch(`${serverUrl}/api/oauth/github/token`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ device_code: deviceCode, user_id: userId }),
    });

    const data = (await res.json()) as GithubTokenPollResponse;

    // Still pending — keep polling
    if (data.error === "authorization_pending" || data.error === "slow_down") {
      continue;
    }

    if (data.error) {
      throw new Error(
        `GitHub authorization failed: ${data.error_description || data.error}`,
      );
    }

    if (!data.access_token) {
      throw new Error("GitHub returned no access token");
    }

    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in ?? 3600,
    };
  }
}

// ─── Token Refresh ─────────────────────────────────────────────────────────────

/**
 * Refresh the Orkestrate access token using the stored refresh token.
 */
export async function refreshAccessToken(): Promise<StoredCredentials | null> {
  const creds = getCredentials();
  if (!creds?.refreshToken) return null;

  const serverUrl = getServerUrl();
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: creds.refreshToken,
    client_id: creds.clientId,
  });

  const res = await fetch(`${serverUrl}/api/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) return null;

  const tokens = (await res.json()) as TokenResponse;
  const now = Math.floor(Date.now() / 1000);

  const newCreds: StoredCredentials = {
    clientId: creds.clientId,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: now + tokens.expires_in,
    userId: creds.userId,
    scope: tokens.scope,
    githubAccessToken: creds.githubAccessToken,
    githubRefreshToken: creds.githubRefreshToken,
    githubExpiresAt: creds.githubExpiresAt,
  };

  setCredentials(newCreds);
  return newCreds;
}

/**
 * Get a valid (non-expired) Orkestrate access token.
 * Automatically refreshes if within 60 seconds of expiry.
 */
export async function getValidToken(): Promise<string | null> {
  const creds = getCredentials();
  if (!creds) return null;

  const now = Math.floor(Date.now() / 1000);

  if (creds.expiresAt <= now + 60) {
    const refreshed = await refreshAccessToken();
    return refreshed?.accessToken || null;
  }

  return creds.accessToken;
}

// ─── Main Login Flow ──────────────────────────────────────────────────────────

/**
 * Run the full Orkestrate + GitHub OAuth login flow.
 *
 * Phase 1: Orkestrate OAuth → identity (stored locally)
 * Phase 2: GitHub OAuth → repo access (proxied through Orkestrate backend)
 *
 * GitHub is best-effort — if it fails, login still succeeds but
 * workspace creation won't work until GitHub is re-connected.
 */
export async function performLogin(): Promise<{
  clientId: string;
  userId: string;
  accessToken: string;
  githubConnected: boolean;
}> {
  const serverUrl = getServerUrl();
  const port = 19274; // "ork" on phone keypad, roughly
  const redirectUri = `http://127.0.0.1:${port}/callback`;

  // ── Phase 1: Orkestrate OAuth ──────────────────────────────────────────────

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
      "Orkestrate OAuth state mismatch — possible CSRF attack. Aborting.",
    );
  }

  const tokens = await exchangeCodeForTokens(
    serverUrl,
    code,
    clientId,
    codeVerifier,
    redirectUri,
  );

  // Resolve userId
  let userId = "";
  try {
    const meRes = await fetch(`${serverUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (meRes.ok) {
      const me = (await meRes.json()) as { id?: string };
      userId = me.id || "";
    }
  } catch {
    // Non-fatal
  }

  const credentials: StoredCredentials = {
    clientId,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: Math.floor(Date.now() / 1000) + tokens.expires_in,
    userId,
    scope: tokens.scope,
  };

  setCredentials(credentials);

  // ── Phase 2: GitHub OAuth (Device Flow) ───────────────────────────────────

  let githubConnected = false;

  try {
    // Start GitHub device flow via Orkestrate proxy
    const deviceData = await startGithubDeviceFlow(
      serverUrl,
      tokens.access_token,
    );

    // Display user code and instructions
    console.error();
    console.error("  GitHub Device Authorization");
    console.error();
    console.error(`  1. Open:   ${deviceData.verification_uri}`);
    console.error(`  2. Enter:  ${deviceData.user_code}`);
    console.error();
    console.error("  Waiting for authorization... (press Ctrl+C to cancel)");

    // Poll until user completes GitHub authorization
    const githubTokens = await pollGithubToken(
      serverUrl,
      tokens.access_token,
      userId,
      deviceData.device_code,
      deviceData.interval,
    );

    setGithubTokens({
      accessToken: githubTokens.access_token,
      refreshToken: githubTokens.refresh_token,
      expiresAt:
        Math.floor(Date.now() / 1000) + (githubTokens.expires_in ?? 3600),
    });

    githubConnected = true;
  } catch (err) {
    // Best-effort — warn but don't fail the login
    console.error(
      `[Login] GitHub connection failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    console.error("[Login] Workspace creation requires GitHub access.");
    console.error(
      "[Login] Re-run \`orkestrate login --github\` to connect GitHub later.",
    );
  }

  return {
    clientId,
    userId: credentials.userId,
    accessToken: credentials.accessToken,
    githubConnected,
  };
}

// ─── HTML Pages ───────────────────────────────────────────────────────────────

function buildSuccessPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Orkestrate — Authenticated</title>
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
    <div class="icon">✓</div>
    <h1>Authenticated</h1>
    <p>You're now logged in to Orkestrate. You can close this tab and return to your terminal.</p>
    <p class="hint">This window will close automatically.</p>
  </div>
  <script>setTimeout(() => window.close(), 3000);</script>
</body>
</html>`;
}

function buildErrorPage(message: string): string {
  const escaped = message.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Orkestrate — Error</title>
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
    <div class="icon">✗</div>
    <h1>Authentication Failed</h1>
    <p>${escaped}</p>
  </div>
</body>
</html>`;
}
