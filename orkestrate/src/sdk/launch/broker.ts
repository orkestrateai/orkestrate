import { getAdapter } from "../registry";
import type { Pack } from "../packs/schema";
import { resolvePack } from "../packs/store";
import { createRun, runDir, setRunState, updateRun } from "../runs/registry";
import { packHomePath } from "../packs/paths";
import { join } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import type { RunRecord } from "../runs/types";
import { openInNewTerminal } from "./terminal";
import type { LaunchPlan } from "./types";
import { crossPlatformUtility } from "../cross-platform";

export type LaunchOptions = {
  cwd?: string;
  packId?: string;
};

export async function launchPack(packId: string, options: LaunchOptions = {}): Promise<RunRecord> {
  const pack = await resolvePack(packId);
  const cwd = options.cwd ?? process.cwd();
  const adapter = getAdapter(pack.harness);
  if (!adapter?.compile) {
    throw new Error(`No driver registered for harness "${pack.harness}"`);
  }

  const { newRunId } = await import("../runs/registry");
  const runId = newRunId();
  const run = await createRun({
    packId: pack.id,
    harness: pack.harness,
    cwd,
    title: `orkestrate: ${pack.id} · ${runId}`,
    runId,
  });

  const packHome = packHomePath(pack.id);
  await mkdir(packHome, { recursive: true });

  let plan: LaunchPlan;
  try {
    plan = await adapter.compile(pack, {
      cwd,
      runId: run.id,
      packHome,
      crossPlatform: crossPlatformUtility,
    });
    plan.title = run.title;
  } catch (error) {
    await setRunState(run.id, "failed", {
      endedAt: new Date().toISOString(),
    });
    throw error;
  }

  const runnerScript = join(import.meta.dir, "runner.ts");
  const dir = runDir(run.id);
  await writeFile(join(dir, "launch.json"), JSON.stringify(plan, null, 2) + "\n");

  try {
    await openInNewTerminal({
      plan,
      runId: run.id,
      runnerScript,
      launchCmdPath: join(dir, "launch.cmd"),
    });
    return updateRun(run.id, { state: "starting" });
  } catch (error) {
    await setRunState(run.id, "failed", { endedAt: new Date().toISOString() });
    throw error;
  }
}

export async function stopRun(runId: string): Promise<RunRecord> {
  const { getRun } = await import("../runs/registry");
  const run = await getRun(runId);
  if (run.pid) {
    try {
      process.kill(run.pid);
    } catch {
      // process may already be gone
    }
  }
  return updateRun(runId, {
    state: "stopped",
    endedAt: new Date().toISOString(),
  });
}