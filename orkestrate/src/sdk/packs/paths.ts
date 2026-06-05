import { join } from "node:path";
import { homedir } from "node:os";

export const PACK_MANIFEST = "pack.yaml";
export const HARNESS_DIR = "harnesses";

export const workspacePacksDir = join(process.cwd(), ".orkestrate", "packs");
export const globalPacksDir = join(homedir(), ".orkestrate", "packs");
export const workspaceRunsDir = join(process.cwd(), ".orkestrate", "runs");
/** Persistent OpenCode home per pack in this workspace (sessions survive relaunches). */
export const workspacePackHomesDir = join(process.cwd(), ".orkestrate", "pack-homes");

export function packHomePath(packId: string): string {
  return join(workspacePackHomesDir, packId, "home");
}

export function harnessSliceDir(packRoot: string, harness: string): string {
  return join(packRoot, HARNESS_DIR, harness);
}