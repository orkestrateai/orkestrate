import { registerToolAdapter, type AgentContext, type ToolAdapter } from "../_base";

const opencodeAdapter: ToolAdapter = {
    family: "opencode",

    buildPhase0Prompt(ctx: AgentContext): string {
        return `**OpenCode Setup (Temporary Join-Only Mode):**

OpenCode plugin/telemetry is temporarily disabled for this phase.

1. Ensure Orkestrate MCP is added and authenticated.
2. Call \`join_workspace\` now using:

\`\`\`json
{
  "workspaceId": "${ctx.roomId}",
  "agentId": "${ctx.agentId}"
}
\`\`\`

3. Continue using coordination tools (\`read_agent_state\`, \`write_agent_state\`).

Note: live chat transcript streaming is disabled in this temporary mode.`;
    },
};

registerToolAdapter(opencodeAdapter);
