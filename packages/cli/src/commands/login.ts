/**
 * orkestrate login
 *
 * Authenticate with Orkestrate browser OAuth.
 * GitHub authorization is optional and can be forced with --github.
 */

import { performLogin } from "../lib/auth.js";
import { getCredentials, getConfigPath } from "../lib/config.js";
import { ui } from "../lib/ui.js";

type LoginOptions = {
  github?: boolean;
  skipGithub?: boolean;
};

export async function loginCommand(options: LoginOptions = {}): Promise<void> {
  const existing = getCredentials();
  if (existing?.accessToken) {
    ui.dim("Refreshing existing session...");
  }

  ui.info("Opening browser for Orkestrate authentication...");
  ui.blank();

  try {
    const githubMode = options.skipGithub
      ? "skip"
      : options.github
        ? "force"
        : "auto";

    const result = await performLogin({ githubMode });
    ui.blank();

    ui.success("Logged in to Orkestrate!");

    if (result.githubStatus === "connected") {
      ui.success("GitHub connected.");
    } else if (result.githubStatus === "already_connected") {
      ui.success("GitHub already connected on your Orkestrate account.");
    } else if (result.githubStatus === "skipped") {
      ui.dim(
        "GitHub authorization skipped. Run `orkestrate login --github` to connect later.",
      );
    } else {
      ui.warn(
        "GitHub not connected - workspace creation will require GitHub access.",
      );
    }

    ui.blank();
    ui.info("Next steps:");
    ui.line(
      "  1. orkestrate init                - link your project to a workspace",
    );
    ui.line(
      "  2. orkestrate connect <tool>      - configure your AI tool (claude, opencode, etc.)",
    );
    ui.line(
      "  3. Run your AI tool               - your agent starts and joins the workspace",
    );
    ui.line("  4. In your AI tool, call: join_workspace <workspace_id>");
    ui.blank();
    ui.dim(`Credentials stored at: ${getConfigPath()}`);
  } catch (err) {
    ui.error(
      `Login failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    process.exit(1);
  }
}
