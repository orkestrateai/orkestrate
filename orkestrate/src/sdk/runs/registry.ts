import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import type { RunRecord, RunState } from "./types";
import { workspaceRunsDir } from "../packs/paths";

const STARTING_GRACE_MS = 12_000;

export function runDir(runId: string): string {
  return join(workspaceRunsDir, runId);
}

export function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    return code === "EPERM";
  }
}

function startedMs(run: RunRecord): number {
  return Date.parse(run.startedAt) || 0;
}

function ageMs(run: RunRecord): number {
  return Date.now() - startedMs(run);
}

/** Whether this run should show as active in the TUI. */
export function isActiveRun(run: RunRecord): boolean {
  if (run.state === "running") {
    return run.pid != null && isProcessAlive(run.pid);
  }
  if (run.state === "starting") {
    return ageMs(run) < STARTING_GRACE_MS;
  }
  return false;
}

export function activeRunsForPack(runs: RunRecord[], packId: string): RunRecord[] {
  return runs.filter((r) => r.packId === packId && isActiveRun(r));
}

/** Mark stale or dead runs so the TUI can show idle accurately. */
export async function reconcileRuns(): Promise<void> {
  const runs = await listRuns();
  const now = new Date().toISOString();

  for (const run of runs) {
    if (run.state === "starting") {
      if (run.pid && isProcessAlive(run.pid)) continue;
      if (!run.pid && ageMs(run) < STARTING_GRACE_MS) continue;
      await updateRun(run.id, {
        state: "failed",
        endedAt: now,
      });
      continue;
    }

    if (run.state === "running") {
      if (run.pid && isProcessAlive(run.pid)) continue;
      await updateRun(run.id, {
        state: "exited",
        endedAt: run.endedAt ?? now,
      });
    }
  }
}

export function runRecordPath(runId: string): string {
  return join(runDir(runId), "run.json");
}

export function newRunId(): string {
  return randomBytes(4).toString("hex");
}

export async function ensureRunsDir(): Promise<void> {
  await mkdir(workspaceRunsDir, { recursive: true });
}

export async function createRun(input: {
  packId: string;
  harness: string;
  cwd: string;
  title: string;
  runId?: string;
}): Promise<RunRecord> {
  await ensureRunsDir();
  const id = input.runId ?? newRunId();
  const dir = runDir(id);
  await mkdir(dir, { recursive: true });
  const record: RunRecord = {
    id,
    packId: input.packId,
    harness: input.harness,
    cwd: input.cwd,
    state: "starting",
    startedAt: new Date().toISOString(),
    title: input.title,
    terminalMode: "window",
  };
  await writeFile(runRecordPath(id), JSON.stringify(record, null, 2) + "\n");
  return record;
}

export async function updateRun(runId: string, patch: Partial<RunRecord>): Promise<RunRecord> {
  const record = await getRun(runId);
  const next = { ...record, ...patch };
  await writeFile(runRecordPath(runId), JSON.stringify(next, null, 2) + "\n");
  return next;
}

export async function getRun(runId: string): Promise<RunRecord> {
  const text = await readFile(runRecordPath(runId), "utf-8");
  return JSON.parse(text) as RunRecord;
}

export async function listRuns(): Promise<RunRecord[]> {
  await ensureRunsDir();
  let names: string[] = [];
  try {
    names = await readdir(workspaceRunsDir);
  } catch {
    return [];
  }
  const records: RunRecord[] = [];
  for (const name of names) {
    try {
      records.push(await getRun(name));
    } catch {
      // skip corrupt
    }
  }
  return records.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export async function setRunState(runId: string, state: RunState, extra?: Partial<RunRecord>): Promise<void> {
  await updateRun(runId, { state, ...extra });
}