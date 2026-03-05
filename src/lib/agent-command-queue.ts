import { randomUUID } from "node:crypto";

export type AgentCommand = {
  id: string;
  scopedAgentId: string;
  workspaceId: string;
  text: string;
  createdAt: string;
};

declare global {
  var __orkestrateCommandQueue: Map<string, AgentCommand[]> | undefined;
  var __orkestrateCommandWaiters: Map<string, Set<() => void>> | undefined;
}

function getQueue() {
  if (!global.__orkestrateCommandQueue) {
    global.__orkestrateCommandQueue = new Map<string, AgentCommand[]>();
  }
  return global.__orkestrateCommandQueue;
}

function getWaiters() {
  if (!global.__orkestrateCommandWaiters) {
    global.__orkestrateCommandWaiters = new Map<string, Set<() => void>>();
  }
  return global.__orkestrateCommandWaiters;
}

function notifyWaiters(scopedAgentId: string) {
  const waiters = getWaiters();
  const set = waiters.get(scopedAgentId);
  if (!set || set.size === 0) return;

  waiters.delete(scopedAgentId);
  for (const wake of set) {
    try { wake(); } catch { }
  }
}

export function hasPendingAgentCommands(scopedAgentId: string) {
  const queue = getQueue();
  const list = queue.get(scopedAgentId);
  return Boolean(list && list.length > 0);
}

export function waitForAgentCommand(scopedAgentId: string, timeoutMs = 0): Promise<boolean> {
  if (hasPendingAgentCommands(scopedAgentId)) return Promise.resolve(true);

  const ms = Math.max(0, Math.floor(timeoutMs));
  if (ms === 0) return Promise.resolve(false);

  return new Promise<boolean>((resolve) => {
    const waiters = getWaiters();
    let set = waiters.get(scopedAgentId);
    if (!set) {
      set = new Set<() => void>();
      waiters.set(scopedAgentId, set);
    }

    let done = false;
    const finish = (ready: boolean) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      set!.delete(handle);
      if (set!.size === 0) waiters.delete(scopedAgentId);
      resolve(ready);
    };

    const handle = () => finish(true);
    const timer = setTimeout(() => finish(false), ms);
    set.add(handle);

    // Race-safe: queue may receive a command between initial check and waiter registration.
    if (hasPendingAgentCommands(scopedAgentId)) finish(true);
  });
}

export function enqueueAgentCommand(scopedAgentId: string, workspaceId: string, text: string): AgentCommand {
  const queue = getQueue();
  const command: AgentCommand = {
    id: `cmd_${randomUUID().replace(/-/g, "").slice(0, 12)}`,
    scopedAgentId,
    workspaceId,
    text: text.trim(),
    createdAt: new Date().toISOString(),
  };

  const list = queue.get(scopedAgentId) ?? [];
  list.push(command);
  queue.set(scopedAgentId, list.slice(-100));
  notifyWaiters(scopedAgentId);
  return command;
}

export function pullAgentCommands(scopedAgentId: string, limit = 5): AgentCommand[] {
  const queue = getQueue();
  const list = queue.get(scopedAgentId) ?? [];
  if (list.length === 0) return [];

  const out = list.slice(0, Math.max(1, limit));
  const rest = list.slice(out.length);
  if (rest.length > 0) queue.set(scopedAgentId, rest);
  else queue.delete(scopedAgentId);
  return out;
}
