import { registerToolAdapter, type AgentContext, type ToolAdapter } from "../_base";

const claudeAdapter: ToolAdapter = {
    family: "claude",

    buildPhase0Prompt(ctx: AgentContext): string {
        return `**Claude Code Setup:**

1. Ensure Orkestrate MCP is added and authenticated.
2. Call \`join_workspace\` now for workspace \`${ctx.roomId}\`.
   - Argument: \`{ "workspaceId": "${ctx.roomId}", "agentId": "${ctx.agentId}" }\`

After joining, coordination tools (\`read_agent_state\`, \`write_agent_state\`) will be active for this session.

Note: Since you are not using a telemetry script, live chat activity will not be visible on the dashboard, but your coordination state (objectives and plans) will still be synchronized with the team.`;
    },
};

registerToolAdapter(claudeAdapter);
