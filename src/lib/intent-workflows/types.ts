export type IntentId =
  | "implement"
  | "assist"
  | "delegate"
  | "observe"
  | "review"
  | "handoff";

export type WorkflowPhase =
  | "identified"
  | "read"
  | "claimed"
  | "active"
  | "done"
  | "resync";

export type ConfidenceLabel = "high" | "medium" | "low";

export type IntentDefinition = {
  id: IntentId;
  editable: boolean;
  defaultNextRequiredTool: "read_team_state";
  forbiddenTools: Array<"claim_scope" | "release_scope" | "update_my_state">;
};

export type WorkflowRunContext = {
  runId: string;
  sessionId: string;
  scopedAgentId: string;
  intentId: IntentId;
  phase: WorkflowPhase;
  editable: boolean;
  lastReadStateHash: string | null;
  chainQueue: IntentId[];
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
};

export type IntentResolution = {
  intentId: IntentId;
  confidence: number;
  confidenceLabel: ConfidenceLabel;
  editable: boolean;
  why: string;
};

export type IdentifyIntentArgs = {
  userPrompt: string;
  forceIntent?: IntentId;
  chain?: IntentId[];
};
