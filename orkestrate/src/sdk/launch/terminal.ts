import { spawn } from "node:child_process";
import type { LaunchPlan } from "./types";
import { openWindowsTerminal, writeLaunchCmd } from "./windows";

export type TerminalLaunch = {
  plan: LaunchPlan;
  runId: string;
  runnerScript: string;
  launchCmdPath: string;
};

export async function openInNewTerminal(inv: TerminalLaunch): Promise<void> {
  const { plan, runId, runnerScript } = inv;
  const platform = process.platform;

  if (platform === "win32") {
    await openInNewTerminalWindows(inv);
    return;
  }

  const bunExe = process.execPath;
  const shellLine = `${bunExe} ${quoteUnix(runnerScript)} ${runId}`;

  if (platform === "darwin") {
    const script = `tell application "Terminal" to do script "cd ${escapeApple(plan.cwd)} && ${escapeApple(shellLine)}"`;
    const proc = spawn("osascript", ["-e", script], { detached: true, stdio: "ignore" });
    proc.unref();
    return;
  }

  const shellCmd = `cd ${quoteUnix(plan.cwd)} && ${shellLine}`;
  const candidates = [
    ["gnome-terminal", ["--", "bash", "-lc", shellCmd]],
    ["konsole", ["-e", "bash", "-lc", shellCmd]],
    ["xterm", ["-e", "bash", "-lc", shellCmd]],
  ] as const;

  for (const [bin, args] of candidates) {
    try {
      const proc = spawn(bin, [...args], { detached: true, stdio: "ignore" });
      proc.unref();
      return;
    } catch {
      continue;
    }
  }

  throw new Error("No supported terminal emulator found (try Windows Terminal, Terminal.app, or gnome-terminal)");
}

async function openInNewTerminalWindows(inv: TerminalLaunch): Promise<void> {
  const launchCmdPath = inv.launchCmdPath;
  await writeLaunchCmd({
    launchCmdPath,
    bunExe: process.execPath,
    runnerScript: inv.runnerScript,
    runId: inv.runId,
    cwd: inv.plan.cwd,
  });

  await openWindowsTerminal({
    plan: inv.plan,
    runId: inv.runId,
    runnerScript: inv.runnerScript,
    launchCmdPath,
  });
}

function quoteUnix(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function escapeApple(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}