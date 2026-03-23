/**
 * Orkestrate CLI — Configuration Management
 *
 * Stores credentials and preferences in the user's home directory.
 * Uses the `conf` package for cross-platform config storage.
 */

import Conf from "conf";

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

export function setCredentials(creds: StoredCredentials): void {
  let lastError: Error | undefined;
  for (let i = 0; i < 3; i++) {
    try {
      config.set("credentials", creds);
      return;
    } catch (err: any) {
      lastError = err;
      // Only retry on EPERM/EBUSY (Windows file locking)
      if (err?.code !== "EPERM" && err?.code !== "EBUSY") {
        throw err;
      }
    }
  }
  throw lastError;
}

export function getCredentials(): StoredCredentials | null {
  return config.get("credentials");
}

export function clearCredentials(): void {
  config.set("credentials", null);
}

export function setActiveWorkspace(id: string, name: string): void {
  config.set("activeWorkspaceId", id);
  config.set("activeWorkspaceName", name);
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
  config.set("serverUrl", url);
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
