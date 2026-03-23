/**
 * Orkestrate CLI — Configuration Management
 *
 * Stores credentials and preferences in the user's home directory.
 * Uses the `conf` package for cross-platform config storage.
 */

import Conf from "conf";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import { mkdirSync } from "node:fs";

export interface StoredCredentials {
  clientId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // epoch seconds
  userId: string;
  scope: string;
  githubAccessToken?: string;
  githubRefreshToken?: string;
  githubExpiresAt?: number; // epoch seconds
}

export interface CliConfig {
  credentials: StoredCredentials | null;
  activeWorkspaceId: string | null;
  activeWorkspaceName: string | null;
  serverUrl: string;
}

const config = new Conf<CliConfig>({
  projectName: "orkestrate",
  projectSuffix: "",
  defaults: {
    credentials: null,
    activeWorkspaceId: null,
    activeWorkspaceName: null,
    serverUrl: "https://orkestrate.space",
  },
});

export function getConfig(): CliConfig {
  return {
    credentials: config.get("credentials"),
    activeWorkspaceId: config.get("activeWorkspaceId"),
    activeWorkspaceName: config.get("activeWorkspaceName"),
    serverUrl: config.get("serverUrl"),
  };
}

export function getServerUrl(): string {
  return config.get("serverUrl");
}

// Helper for config writes with retry and exponential backoff
function setConfigWithRetry(
  key: string,
  value: unknown,
  maxAttempts = 5,
): void {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      config.set(key, value);
      return;
    } catch (err: any) {
      // Only retry on EPERM/EBUSY (Windows file locking)
      if (err?.code !== "EPERM" && err?.code !== "EBUSY") {
        throw err;
      }
      // Exponential backoff: 50ms, 100ms, 200ms, 400ms, 800ms
      const delay = 50 * Math.pow(2, attempt);
      if (attempt < maxAttempts - 1) {
        const start = Date.now();
        while (Date.now() - start < delay) {
          // busy wait
        }
      }
    }
  }

  // Fallback: direct file write bypassing conf's atomic operations
  try {
    const configPath = config.path;
    const dir = dirname(configPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    let currentConfig: Record<string, unknown> = {};
    if (existsSync(configPath)) {
      try {
        currentConfig = JSON.parse(readFileSync(configPath, "utf-8"));
      } catch {
        currentConfig = {};
      }
    }
    currentConfig[key] = value;
    writeFileSync(configPath, JSON.stringify(currentConfig, null, 2), "utf-8");
    return;
  } catch (fallbackErr) {
    throw new Error(
      `Failed to save config after ${maxAttempts} attempts. Original error: ${fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr)}`,
    );
  }
}

export function setCredentials(creds: StoredCredentials): void {
  setConfigWithRetry("credentials", creds);
}

export function getCredentials(): StoredCredentials | null {
  return config.get("credentials");
}

export function clearCredentials(): void {
  setConfigWithRetry("credentials", null);
}

export function setActiveWorkspace(id: string, name: string): void {
  setConfigWithRetry("activeWorkspaceId", id);
  setConfigWithRetry("activeWorkspaceName", name);
}

export function getActiveWorkspace(): {
  id: string | null;
  name: string | null;
} {
  return {
    id: config.get("activeWorkspaceId"),
    name: config.get("activeWorkspaceName"),
  };
}

export function setServerUrl(url: string): void {
  setConfigWithRetry("serverUrl", url);
}

export function clearAll(): void {
  config.clear();
}

export function getConfigPath(): string {
  return config.path;
}

// --- GitHub Token Management ---

export interface GithubTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number; // epoch seconds
}

export function setGithubTokens(tokens: GithubTokens): void {
  const creds = getCredentials();
  if (!creds) return;

  creds.githubAccessToken = tokens.accessToken;
  creds.githubRefreshToken = tokens.refreshToken;
  creds.githubExpiresAt = tokens.expiresAt;

  setCredentials(creds);
}

export function getGithubTokens(): GithubTokens | null {
  const creds = getCredentials();
  if (!creds?.githubAccessToken || !creds.githubExpiresAt) return null;

  return {
    accessToken: creds.githubAccessToken,
    refreshToken: creds.githubRefreshToken,
    expiresAt: creds.githubExpiresAt,
  };
}

export function getValidGithubToken(): string | null {
  const tokens = getGithubTokens();
  if (!tokens) return null;

  const now = Math.floor(Date.now() / 1000);

  // Consider expired if within 60 seconds of expiry
  if (tokens.expiresAt <= now + 60) return null;

  return tokens.accessToken;
}

export function hasGithubToken(): boolean {
  return getValidGithubToken() !== null;
}
