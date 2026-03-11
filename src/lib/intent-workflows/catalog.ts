import type { IntentDefinition, IntentId } from "@/lib/intent-workflows/types";

const INTENT_DEFINITIONS: Record<IntentId, IntentDefinition> = {
  implement: {
    id: "implement",
    editable: true,
    defaultNextRequiredTool: "read_team_state",
    forbiddenTools: [],
  },
  assist: {
    id: "assist",
    editable: true,
    defaultNextRequiredTool: "read_team_state",
    forbiddenTools: [],
  },
  delegate: {
    id: "delegate",
    editable: false,
    defaultNextRequiredTool: "read_team_state",
    forbiddenTools: ["claim_scope"],
  },
  observe: {
    id: "observe",
    editable: false,
    defaultNextRequiredTool: "read_team_state",
    forbiddenTools: ["claim_scope", "release_scope"],
  },
  review: {
    id: "review",
    editable: false,
    defaultNextRequiredTool: "read_team_state",
    forbiddenTools: ["claim_scope", "release_scope"],
  },
  handoff: {
    id: "handoff",
    editable: false,
    defaultNextRequiredTool: "read_team_state",
    forbiddenTools: ["claim_scope"],
  },
};

export function isIntentId(value: unknown): value is IntentId {
  return value === "implement"
    || value === "assist"
    || value === "delegate"
    || value === "observe"
    || value === "review"
    || value === "handoff";
}

export function getIntentDefinition(intentId: IntentId): IntentDefinition {
  return INTENT_DEFINITIONS[intentId];
}

export function listIntentIds(): IntentId[] {
  return Object.keys(INTENT_DEFINITIONS) as IntentId[];
}
