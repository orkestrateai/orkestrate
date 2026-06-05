import type { Pack } from "./packs/schema";

export interface HarnessStatus {
  installed: boolean;
  version?: string;
  path?: string;
  error?: string;
}

export interface CompileContext {
  cwd: string;
  runId: string;
  /** Persistent harness home for this pack (shared across runs of the same pack). */
  packHome: string;
  crossPlatform: CrossPlatformUtility;
}

export interface LaunchPlan {
  command: string;
  args: string[];
  cwd: string;
  env: Record<string, string>;
  title: string;
}

export interface CrossPlatformUtility {
  hijackHome(fakeHomePath: string): Record<string, string>;
}

/** Harness driver: compile pack + run home → launch plan (core spawns). */
export interface HarnessDriver {
  id: string;
  name: string;
  detect(): Promise<HarnessStatus>;
  compile(pack: Pack, context: CompileContext): Promise<LaunchPlan>;
}

/** @deprecated use HarnessDriver */
export type HarnessAdapter = HarnessDriver;