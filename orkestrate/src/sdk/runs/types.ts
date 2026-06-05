export type RunState = "starting" | "running" | "exited" | "failed" | "stopped";

export type RunRecord = {
  id: string;
  packId: string;
  harness: string;
  cwd: string;
  state: RunState;
  pid?: number;
  startedAt: string;
  endedAt?: string;
  exitCode?: number;
  title: string;
  terminalMode: "window";
};