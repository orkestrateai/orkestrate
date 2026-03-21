/**
 * orkestrate logout
 *
 * Clear stored credentials.
 */

import { clearCredentials, getCredentials, getConfigPath } from "../lib/config.js";
import { ui } from "../lib/ui.js";

export function logoutCommand(): void {
  const existing = getCredentials();

  if (!existing?.accessToken) {
    ui.dim("Not currently logged in.");
    return;
  }

  clearCredentials();
  ui.success("Logged out. Credentials cleared.");
  ui.dim(`Config: ${getConfigPath()}`);
}
