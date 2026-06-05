import { launchPack, stopRun } from "../../sdk/launch/broker";
import { getRun, listRuns, reconcileRuns } from "../../sdk/runs/registry";

export async function runLaunch(packId: string): Promise<void> {
  const run = await launchPack(packId);
  console.log(`runId=${run.id}`);
  console.log(`pack=${run.packId}`);
  console.log(`state=${run.state}`);
  console.log(`Opened new terminal: ${run.title}`);
}

export async function runSpawn(packId: string): Promise<void> {
  await runLaunch(packId);
}

export async function runList(): Promise<void> {
  await reconcileRuns();
  const runs = await listRuns();
  if (runs.length === 0) {
    console.log("No runs.");
    return;
  }
  for (const run of runs) {
    console.log(`${run.id}  ${run.packId}  ${run.state}  ${run.startedAt}`);
    if (run.pid) console.log(`  pid=${run.pid}`);
  }
}

export async function runStatus(runId: string): Promise<void> {
  const run = await getRun(runId);
  console.log(JSON.stringify(run, null, 2));
}

export async function runStop(runId: string): Promise<void> {
  const run = await stopRun(runId);
  console.log(`Stopped ${run.id} (${run.state})`);
}