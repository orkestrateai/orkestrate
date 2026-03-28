/**
 * Orkestrate CLI - Configuration Management
 *
 * Stores credentials and preferences in a JSON file in the user's config dir.
 * This avoids atomic rename behavior that can fail on Windows with EPERM.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export interface UserToolSettings {
  enabledTools?: string[] | null; // null = all enabled
  disabledTools?: string[]; // explicit disable list
}

export interface CliConfig {
  credentials: StoredCredentials | null;
  activeWorkspaceId: string | null;
  activeWorkspaceName: string | null;
  serverUrl: string;
  userToolSettings?: UserToolSettings;
}

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

const DEFAULT_CONFIG: CliConfig = {
  credentials: null,
  activeWorkspaceId: null,
  activeWorkspaceName: null,
  serverUrl: "https://orkestrate.space",
  userToolSettings: {},
};

function resolveConfigPath(): string {
  if (process.platform === "win32") {
    const appData =
      process.env.APPDATA || join(homedir(), "AppData", "Roaming");
    // Keep the existing Windows path used by current installs for compatibility.
    return join(appData, "orkestrate", "Config", "config.json");
  }

  const xdgConfigHome = process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
  return join(xdgConfigHome, "orkestrate", "config.json");
}

const configPath = resolveConfigPath();

function sleepMs(delayMs: number): void {
  const start = Date.now();
  while (Date.now() - start < delayMs) {
    // Busy wait is acceptable in short-lived CLI flows.
  }
}

function isRetriableConfigWriteError(err: unknown): boolean {
  if (!err) return false;
  const code =
    typeof err === "object" && err !== null && "code" in err
      ? String((err as { code?: unknown }).code ?? "")
      : "";
  const message =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : String(err);

  if (code === "EPERM" || code === "EBUSY") return true;
  return /(EPERM|EBUSY|operation not permitted|resource busy|rename)/i.test(
    message,
  );
}

function cloneDefaults(): CliConfig {
  return {
    credentials: DEFAULT_CONFIG.credentials,
    activeWorkspaceId: DEFAULT_CONFIG.activeWorkspaceId,
    activeWorkspaceName: DEFAULT_CONFIG.activeWorkspaceName,
    serverUrl: DEFAULT_CONFIG.serverUrl,
    userToolSettings: {},
  };
}

function normalizeUserToolSettings(input: unknown): UserToolSettings {
  if (!input || typeof input !== "object") return {};

  const source = input as Record<string, unknown>;
  const enabledRaw = source.enabledTools;
  const disabledRaw = source.disabledTools;

  const enabledTools =
    enabledRaw === null
      ? null
      : Array.isArray(enabledRaw)
        ? enabledRaw.filter((item): item is string => typeof item === "string")
        : undefined;

  const disabledTools = Array.isArray(disabledRaw)
    ? disabledRaw.filter((item): item is string => typeof item === "string")
    : undefined;

  return {
    enabledTools,
    disabledTools,
  };
}

function normalizeConfig(raw: unknown): CliConfig {
  if (!raw || typeof raw !== "object") return cloneDefaults();
  const source = raw as Partial<CliConfig>;

  return {
    credentials: source.credentials ?? null,
    activeWorkspaceId: source.activeWorkspaceId ?? null,
    activeWorkspaceName: source.activeWorkspaceName ?? null,
    serverUrl:
      typeof source.serverUrl === "string" && source.serverUrl.trim().length > 0
        ? source.serverUrl
        : DEFAULT_CONFIG.serverUrl,
    userToolSettings: normalizeUserToolSettings(source.userToolSettings),
  };
}

function readConfigFile(): CliConfig {
  if (!existsSync(configPath)) {
    return cloneDefaults();
  }

  try {
    const raw = JSON.parse(readFileSync(configPath, "utf-8"));
    return normalizeConfig(raw);
  } catch {
    return cloneDefaults();
  }
}

function writeConfigFile(next: CliConfig, maxAttempts = 6): void {
  const dir = dirname(configPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const payload = `${JSON.stringify(next, null, 2)}\n`;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      writeFileSync(configPath, payload, "utf-8");
      return;
    } catch (err) {
      if (!isRetriableConfigWriteError(err)) {
        throw err;
      }

      if (attempt < maxAttempts - 1) {
        sleepMs(50 * Math.pow(2, attempt));
      }
    }
  }

  throw new Error(
    `Failed to write config file at ${configPath} after ${maxAttempts} attempts.`,
  );
}

// Helper for config writes with retry and exponential backoff.
function setConfigWithRetry(
  key: keyof CliConfig,
  value: CliConfig[keyof CliConfig],
  maxAttempts = 6,
): void {
  const current = readConfigFile() as Record<string, unknown>;
  current[key] = value;
  writeConfigFile(normalizeConfig(current), maxAttempts);
}

export function getConfig(): CliConfig {
  return readConfigFile();
}

export function getServerUrl(): string {
  return readConfigFile().serverUrl;
}

export function setCredentials(creds: StoredCredentials): void {
  setConfigWithRetry("credentials", creds);
}

export function getCredentials(): StoredCredentials | null {
  return readConfigFile().credentials;
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
  const config = readConfigFile();
  return {
    id: config.activeWorkspaceId,
    name: config.activeWorkspaceName,
  };
}

export function setServerUrl(url: string): void {
  setConfigWithRetry("serverUrl", url);
}

export function clearAll(): void {
  writeConfigFile(cloneDefaults());
}

export function getConfigPath(): string {
  return configPath;
}

// --- User Tool Settings Management ---

export function getUserToolSettings(): UserToolSettings {
  return readConfigFile().userToolSettings || {};
}

export function setUserToolSettings(settings: UserToolSettings): void {
  setConfigWithRetry("userToolSettings", settings);
}

export function getEnabledTools(): string[] | null {
  const settings = getUserToolSettings();
  return settings.enabledTools ?? null;
}

export function getDisabledTools(): string[] {
  const settings = getUserToolSettings();
  return settings.disabledTools || [];
}

export function setEnabledTools(tools: string[] | null): void {
  const settings = getUserToolSettings();
  settings.enabledTools = tools;
  setUserToolSettings(settings);
}

export function setDisabledTools(tools: string[]): void {
  const settings = getUserToolSettings();
  settings.disabledTools = tools;
  setUserToolSettings(settings);
}

export function isToolAllowed(toolName: string): boolean {
  const enabledTools = getEnabledTools();
  const disabledTools = getDisabledTools();

  // If enabledTools is set (not null), only those tools are allowed.
  if (enabledTools !== null) {
    return enabledTools.includes(toolName);
  }

  // Otherwise, check disabledTools list.
  return !disabledTools.includes(toolName);
}

export function enableTool(toolName: string): void {
  const enabledTools = getEnabledTools();
  const disabledTools = getDisabledTools();

  if (enabledTools !== null) {
    // Additive mode: add to enabled list if not present.
    if (!enabledTools.includes(toolName)) {
      setEnabledTools([...enabledTools, toolName]);
    }
  } else {
    // Subtractive mode: remove from disabled list.
    if (disabledTools.includes(toolName)) {
      setDisabledTools(disabledTools.filter((t) => t !== toolName));
    }
  }
}

export function disableTool(toolName: string): void {
  const enabledTools = getEnabledTools();
  const disabledTools = getDisabledTools();

  if (enabledTools !== null) {
    // Additive mode: remove from enabled list.
    if (enabledTools.includes(toolName)) {
      setEnabledTools(enabledTools.filter((t) => t !== toolName));
    }
  } else {
    // Subtractive mode: add to disabled list.
    if (!disabledTools.includes(toolName)) {
      setDisabledTools([...disabledTools, toolName]);
    }
  }
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

  // Consider expired if within 60 seconds of expiry.
  if (tokens.expiresAt <= now + 60) return null;

  return tokens.accessToken;
}

export function hasGithubToken(): boolean {
  return getValidGithubToken() !== null;
}
