import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { LaunchPlan } from "./types";

export type WindowsLaunch = {
  plan: LaunchPlan;
  runId: string;
  runnerScript: string;
  launchCmdPath: string;
};

/** Escape a value for a line inside a .cmd file. */
function quoteBatch(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

/** Write launch.cmd with fully quoted paths (safe for spaces). */
export async function writeLaunchCmd(input: {
  launchCmdPath: string;
  bunExe: string;
  runnerScript: string;
  runId: string;
  cwd: string;
}): Promise<void> {
  const lines = [
    "@echo off",
    "setlocal",
    `cd /d ${quoteBatch(input.cwd)}`,
    `${quoteBatch(input.bunExe)} ${quoteBatch(input.runnerScript)} ${input.runId}`,
    "set EXITCODE=%ERRORLEVEL%",
    "if %EXITCODE% neq 0 (",
    "  echo.",
    "  echo Orkestrate session failed with exit code %EXITCODE%.",
    "  pause",
    ")",
    "endlocal",
    "exit /b %EXITCODE%",
    "",
  ];
  await mkdir(dirname(input.launchCmdPath), { recursive: true });
  await writeFile(input.launchCmdPath, lines.join("\r\n"), "utf-8");
}

function spawnDetached(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });

    child.once("error", reject);
    child.once("spawn", () => {
      child.unref();
      resolve();
    });
  });
}

/** Prefer direct executable args; fall back to launch.cmd. */
export async function openWindowsTerminal(inv: WindowsLaunch): Promise<void> {
  const { plan, runId, runnerScript, launchCmdPath } = inv;
  const bunExe = process.execPath;

  const wtArgsDirect = [
    "-w",
    "-1",
    "nt",
    "-d",
    plan.cwd,
    "--title",
    plan.title,
    bunExe,
    runnerScript,
    runId,
  ];

  try {
    await spawnDetached("wt.exe", wtArgsDirect);
    return;
  } catch {
    // wt missing or failed — try batch launcher
  }

  const wtArgsBatch = [
    "-w",
    "-1",
    "nt",
    "-d",
    plan.cwd,
    "--title",
    plan.title,
    "cmd.exe",
    "/d",
    "/c",
    launchCmdPath,
  ];

  try {
    await spawnDetached("wt.exe", wtArgsBatch);
    return;
  } catch {
    // fall through
  }

  // Last resort: new console via cmd start + launch.cmd
  await spawnDetached("cmd.exe", ["/c", "start", plan.title, "cmd.exe", "/k", launchCmdPath]);
}