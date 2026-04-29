// simulation/types.ts

export type SimulationStep =
  | "start"
  | "type_join"     // Claude types join
  | "exec_join"     // Claude executes join
  | "kim_work"      // Kim builds API (Codex)
  | "type_intent"   // Claude types intent
  | "exec_intent"   // Claude identifies intent
  | "kim_claim"     // Kim claims scope (Codex)
  | "type_fix"      // Claude types fix
  | "exec_fix"      // Claude executes fix
  | "sam_sync"      // Sam detects Kim's API push (OpenCode)
  | "exec_release"  // Claude finishes and releases
  | "end";

export const STEPS: { id: SimulationStep; duration: number }[] = [
  { id: "start", duration: 800 },
  { id: "type_join", duration: 800 },
  { id: "exec_join", duration: 1500 },
  { id: "kim_work", duration: 2000 },
  { id: "type_intent", duration: 1000 },
  { id: "exec_intent", duration: 2000 },
  { id: "kim_claim", duration: 2000 },
  { id: "type_fix", duration: 1200 },
  { id: "exec_fix", duration: 2500 },
  { id: "sam_sync", duration: 2000 },
  { id: "exec_release", duration: 1500 },
  { id: "end", duration: 2000 },
];