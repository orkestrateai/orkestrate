/**
 * Orkestrate CLI — Git Context Detection
 *
 * Reads git metadata from the current working directory.
 */

import { execSync } from "node:child_process";

export interface GitContext {
  remote: string;
  repoRoot: string;
  branch: string;
  headSha: string;
  dirty: boolean;
  collectedAt: string;
}

function git(cmd: string, cwd: string): string {
  try {
    return execSync(`git ${cmd}`, {
      cwd,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch {
    return "";
  }
}

export function detectGitContext(cwd: string = process.cwd()): GitContext | null {
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
    collectedAt: new Date().toISOString(),
  };
}
