export const TOOL_CATEGORIES = {
  workspace: [
    "identify_intent",
    "join_workspace",
    "read_team_state",
    "claim_scope",
    "release_scope",
    "update_my_state",
  ],
  messaging: ["send_message", "read_messages"],
  knowledge: ["read_knowledge_base", "write_knowledge_base"],
} as const;

export type ToolCategory = keyof typeof TOOL_CATEGORIES;

export function getToolCategory(
  toolName: string,
): (typeof TOOL_CATEGORIES)[ToolCategory] extends readonly string[]
  ? ToolCategory | null
  : never {
  for (const [category, tools] of Object.entries(TOOL_CATEGORIES)) {
    if ((tools as readonly string[]).includes(toolName)) {
      return category as ToolCategory;
    }
  }
  return null;
}

export function getAllTools(): string[] {
  return Object.values(TOOL_CATEGORIES).flat();
}
