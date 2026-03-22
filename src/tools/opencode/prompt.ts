import { registerToolAdapter, type AgentContext, type ToolAdapter } from "../_base";

const opencodeAdapter: ToolAdapter = {
  family: "opencode",

  buildPhase0Prompt(ctx: AgentContext): string {
    return `**OpenCode Setup:**

1. Ensure Orkestrate MCP is added and authenticated.
2. Call \`join_workspace\` now with your current git-derived context:

\`\`\`json
{
  "workspaceId": "${ctx.workspaceId}",
  "agentId": "${ctx.agentId}",
  "toolName": "OpenCode",
  "gitContext": {
    "remote": "<git remote get-url origin>",
    "repoRoot": "<git rev-parse --show-toplevel>",
    "branch": "<git rev-parse --abbrev-ref HEAD>",
    "headSha": "<git rev-parse HEAD>",
    "dirty": false,
    "collectedAt": "<ISO timestamp>"
  }
}
\`\`\`

3. For every new user task, call \`identify_intent\` first.
4. After every coordination call, follow returned \`nextRequiredTool\` exactly.`;
  },
};

registerToolAdapter(opencodeAdapter);
