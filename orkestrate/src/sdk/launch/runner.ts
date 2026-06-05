/**
 * Executed inside the new terminal window. Tracks the real agent PID and exit state.
 * Usage: bun runner.ts <runId>
 */
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { updateRun, runDir } from "../runs/registry";
import type { LaunchPlan } from "./types";

const runId = process.argv[2];
if (!runId) {
  console.error("Usage: bun runner.ts <runId>");
  process.exit(1);
}

const planPath = join(runDir(runId), "launch.json");
const plan = JSON.parse(await readFile(planPath, "utf-8")) as LaunchPlan;

await updateRun(runId, { state: "running" });

const child = spawn(plan.command, plan.args, {
  cwd: plan.cwd,
  env: { ...process.env, ...plan.env },
  stdio: "inherit",
  shell: process.platform === "win32",
});

if (child.pid) {
  await updateRun(runId, { pid: child.pid });
}

child.on("exit", (code, signal) => {
  void (async () => {
    const endedAt = new Date().toISOString();
    const exitCode = code ?? undefined;
    const failed = signal != null || (code != null && code !== 0);
    await updateRun(runId, {
      state: failed ? "failed" : "exited",
      exitCode,
      endedAt,
    });
    if (process.platform === "win32" && failed) {
      // Keep window open on failure so the user can read errors.
      return;
    }
    process.exit(code ?? 1);
  })();
});

child.on("error", (error) => {
  console.error(error);
  void updateRun(runId, {
    state: "failed",
    endedAt: new Date().toISOString(),
  }).finally(() => process.exit(1));
});