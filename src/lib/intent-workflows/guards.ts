import type { WorkflowPhase, WorkflowRunContext } from "@/lib/intent-workflows/types";

export type GuardErrorCode =
  | "WORKFLOW_REQUIRED"
  | "WORKFLOW_STEP_VIOLATION"
  | "INTENT_DISALLOWS_WRITE"
  | "WORKFLOW_RESYNC_REQUIRED";

export type GuardError = {
  ok: false;
  errorCode: GuardErrorCode;
  currentPhase: WorkflowPhase | "none";
  nextRequiredTool: string;
  why: string;
  allowedToolsNow: string[];
  recoverySteps: string[];
};

export type GuardSuccess = { ok: true };

function guardFailure(input: Omit<GuardError, "ok">): GuardError {
  return { ok: false, ...input };
}

function requiresResync(run: WorkflowRunContext | null): GuardError | null {
  if (!run) return null;
  if (run.phase !== "resync") return null;
  return guardFailure({
    errorCode: "WORKFLOW_RESYNC_REQUIRED",
    currentPhase: run.phase,
    nextRequiredTool: "read_team_state",
    why: "Workflow is in resync mode after mismatch/conflict. Read fresh team state before any write action.",
    allowedToolsNow: ["read_team_state"],
    recoverySteps: [
      "Call read_team_state and capture the latest stateHash.",
      "Retry your intended write tool using the new stateHash.",
    ],
  });
}

export function enforceWriteToolGuard(input: {
  toolName: "claim_scope" | "update_my_state" | "release_scope";
  run: WorkflowRunContext | null;
  hasNonEmptyFootprint?: boolean;
}): GuardSuccess | GuardError {
  const { toolName, run, hasNonEmptyFootprint = false } = input;

  if (!run) {
    return guardFailure({
      errorCode: "WORKFLOW_REQUIRED",
      currentPhase: "none",
      nextRequiredTool: "identify_intent",
      why: "No active intent workflow run exists for this session.",
      allowedToolsNow: ["identify_intent", "read_team_state"],
      recoverySteps: [
        "Call identify_intent for the current task prompt.",
        "Call read_team_state next, then retry this write tool.",
      ],
    });
  }

  const resyncError = requiresResync(run);
  if (resyncError) return resyncError;

  if (!run.editable) {
    if (toolName === "claim_scope") {
      return guardFailure({
        errorCode: "INTENT_DISALLOWS_WRITE",
        currentPhase: run.phase,
        nextRequiredTool: "read_team_state",
        why: `Intent '${run.intentId}' is non-edit and cannot claim paths.`,
        allowedToolsNow: ["read_team_state", "update_my_state"],
        recoverySteps: [
          "Keep footprint empty for non-edit intents.",
          "If you need edits, call identify_intent with an editable intent (for example implement).",
        ],
      });
    }

    if (toolName === "update_my_state" && hasNonEmptyFootprint) {
      return guardFailure({
        errorCode: "INTENT_DISALLOWS_WRITE",
        currentPhase: run.phase,
        nextRequiredTool: "update_my_state",
        why: `Intent '${run.intentId}' only allows empty footprint state updates.`,
        allowedToolsNow: ["read_team_state", "update_my_state", "release_scope"],
        recoverySteps: [
          "Retry update_my_state with empty architectureFootprint.",
          "Use notesForTeam/currentObjective to communicate progress for non-edit intent.",
        ],
      });
    }
  }

  if (toolName === "claim_scope" && run.phase !== "read") {
    return guardFailure({
      errorCode: "WORKFLOW_STEP_VIOLATION",
      currentPhase: run.phase,
      nextRequiredTool: "read_team_state",
      why: "claim_scope is only valid immediately after a fresh team state read.",
      allowedToolsNow: ["read_team_state"],
      recoverySteps: [
        "Call read_team_state to refresh stateHash.",
        "Retry claim_scope using the returned stateHash.",
      ],
    });
  }

  if (toolName === "update_my_state" && hasNonEmptyFootprint && run.phase !== "claimed" && run.phase !== "active") {
    return guardFailure({
      errorCode: "WORKFLOW_STEP_VIOLATION",
      currentPhase: run.phase,
      nextRequiredTool: "claim_scope",
      why: "Non-empty architectureFootprint requires a claimed or active workflow phase.",
      allowedToolsNow: ["claim_scope", "read_team_state"],
      recoverySteps: [
        "Call claim_scope for your intended footprint paths.",
        "Retry update_my_state with the latest stateHash.",
      ],
    });
  }

  if (toolName === "release_scope" && run.phase !== "claimed" && run.phase !== "active" && run.phase !== "done") {
    return guardFailure({
      errorCode: "WORKFLOW_STEP_VIOLATION",
      currentPhase: run.phase,
      nextRequiredTool: "update_my_state",
      why: "release_scope is only valid after a claim has been made and work has started or completed.",
      allowedToolsNow: ["read_team_state", "update_my_state"],
      recoverySteps: [
        "Publish state progression first with update_my_state.",
        "Retry release_scope once phase is claimed, active, or done.",
      ],
    });
  }

  return { ok: true };
}

