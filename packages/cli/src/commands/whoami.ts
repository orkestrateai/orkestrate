/**
 * orkestrate whoami
 *
 * Show current authentication and configuration state.
 */

import { getCredentials, getActiveWorkspace, getServerUrl, getConfigPath } from "../lib/config.js";
import { checkHealth } from "../lib/api.js";
import { ui } from "../lib/ui.js";

export async function whoamiCommand(): Promise<void> {
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
        const { getMe } = await import("../lib/api.js");
        const user = await getMe();
        ui.kv("User", user.email);
        ui.kv("User ID", user.id);
    } catch {
        ui.kv("Client ID", creds.clientId);
        ui.dim("Could not fetch user info from server.");
    }

    const expiresIn = creds.expiresAt - Math.floor(Date.now() / 1000);
    if (expiresIn > 0) {
      const minutes = Math.floor(expiresIn / 60);
      ui.kv("Token expires", `in ${minutes} minute(s)`);
    } else {
      ui.warn("Access token expired — will auto-refresh on next API call.");
    }
  } else {
    ui.error("Not authenticated. Run `orkestrate login`.");
  }

  ui.blank();

  if (workspace.id) {
    ui.kv("Active workspace", workspace.name || "—");
    ui.kv("Workspace ID", workspace.id);
  } else {
    ui.dim("No active workspace set.");
  }

  ui.blank();

  // Server health check
  ui.info("Checking server health...");
  const healthy = await checkHealth();
  if (healthy) {
    ui.success("Server is reachable");
  } else {
    ui.error("Server is unreachable");
  }
}
