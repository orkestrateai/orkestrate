import { randomUUID } from "node:crypto";
import type { IntentId, WorkflowPhase, WorkflowRunContext } from "@/lib/intent-workflows/types";

export const WORKFLOW_RUN_TTL_MS = 30 * 60 * 1000;

export function workflowRunKey(scopedAgentId: string, sessionId: string) {
  return `${scopedAgentId}:${sessionId}`;
}

export function createWorkflowRun(input: {
  sessionId: string;
  scopedAgentId: string;
  intentId: IntentId;
  editable: boolean;
  chainQueue: IntentId[];
  now?: Date;
}): WorkflowRunContext {
  const now = input.now ?? new Date();
  return {
    runId: `run_${randomUUID().replace(/-/g, "").slice(0, 16)}`,
    sessionId: input.sessionId,
    scopedAgentId: input.scopedAgentId,
    intentId: input.intentId,
    phase: "identified",
    editable: input.editable,
    lastReadStateHash: null,
    chainQueue: [...input.chainQueue],
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + WORKFLOW_RUN_TTL_MS).toISOString(),
  };
}

export function isRunExpired(run: WorkflowRunContext, now = new Date()) {
  return Date.parse(run.expiresAt) <= now.getTime();
}

export function pruneExpiredRuns(map: Map<string, WorkflowRunContext>, now = new Date()) {
  for (const [key, run] of map.entries()) {
    if (isRunExpired(run, now)) {
      map.delete(key);
    }
  }
}

export function touchRun(
  run: WorkflowRunContext,
  patch?: Partial<Pick<WorkflowRunContext, "phase" | "lastReadStateHash" | "chainQueue" | "intentId" | "editable">>,
  now = new Date(),
): WorkflowRunContext {
  const next: WorkflowRunContext = {
    ...run,
    ...(patch || {}),
    updatedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + WORKFLOW_RUN_TTL_MS).toISOString(),
  };
  return next;
}

export function setRunPhase(run: WorkflowRunContext, phase: WorkflowPhase, now = new Date()) {
  return touchRun(run, { phase }, now);
}

