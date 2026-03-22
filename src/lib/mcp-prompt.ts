/**
 * Shared MCP Prompt Builder
 *
 * Builds the Orkestrate protocol prompt by combining tool-specific setup
 * from the adapter with shared workflow guidance and optional reconnection context.
 */

import type { AgentContext } from "@/tools/_base";
import { getToolAdapter } from "@/tools/_base";

export interface ReconnectionState {
    stateContent: {
        agentProfile: string;
        currentObjective: string;
        architectureFootprint: string[];
        pastWorkSummary?: string[];
        notesForTeam: string;
    };
    lastPingAt: Date;
}

export function buildSessionResumedBlock(state: ReconnectionState): string {
    const s = state.stateContent;
    const lastSeenAgo = Math.round(
        (Date.now() - state.lastPingAt.getTime()) / 1000,
    );
    const footprint =
        s.architectureFootprint.length > 0
            ? s.architectureFootprint.map((f) => `  - ${f}`).join("\n")
            : "  (none)";
    const pastWork =
        s.pastWorkSummary && s.pastWorkSummary.length > 0
            ? s.pastWorkSummary.map((w) => `  - ${w}`).join("\n")
            : "  (none)";

    return `

---

## Session Resumed

You are reconnecting to an existing session. Your prior state has been preserved.

**Last seen:** ${lastSeenAgo < 60 ? `${lastSeenAgo}s ago` : `${Math.round(lastSeenAgo / 60)}m ago`}
**Prior objective:** ${s.currentObjective}
**Agent profile:** ${s.agentProfile}
**Architecture footprint:**
${footprint}
**Past work summary:**
${pastWork}
**Notes for team:** ${s.notesForTeam}

**What to do now:**
1. Run the setup steps again with the same agent id and workspace.
2. Call \`read_team_state\` to refresh stateHash and active claims.
3. For any new user task, call \`identify_intent\` first.
4. Follow returned \`nextRequiredTool\` exactly.
5. Do not recreate your workspace file if it already exists.`;
}

export function buildOrkestratePrompt(
    family: string,
    ctx: AgentContext,
    reconnection: ReconnectionState | null,
): string {
    const adapter = getToolAdapter(family);
    const phase0 = adapter.buildPhase0Prompt(ctx);
    const isReconnection = reconnection !== null;
    const sessionContextBlock = isReconnection
        ? buildSessionResumedBlock(reconnection)
        : "";

    return `
# Orkestrate: MCP Coordination Protocol

You are part of a multi-agent system connected via Orkestrate MCP.
Treat tool workflow responses as authoritative.
${isReconnection ? "\n> NOTE: This is a session reconnection. See Session Resumed below." : ""}

## Mandatory Rule
For every new task-like user request, call \`identify_intent\` first.
After that, always call the tool named in \`nextRequiredTool\`.

## Coordination Contract
1. Call \`join_workspace\` at session start/reconnect with gitContext.
2. Call \`identify_intent\` for each new task.
3. Call \`read_team_state\` when instructed and after any mismatch/conflict.
4. Editable intents: \`claim_scope\` before file edits.
5. Non-edit intents: keep \`architectureFootprint\` empty in \`update_my_state\`.
6. On \`ok: false\`, execute \`recoverySteps\` in order.
7. On completion/handoff, publish empty footprint and release scope.

## Session Setup (Run Now)
Workspace id: \`${ctx.workspaceId}\`
Canonical agent id: \`${ctx.agentId}\`

${phase0}

## Quick Flow Examples
Editable intent:
1. \`identify_intent\`
2. \`read_team_state\`
3. \`claim_scope\`
4. \`update_my_state\`
5. Execute work
6. \`update_my_state\` checkpoints
7. \`release_scope\`

Non-edit intent:
1. \`identify_intent\`
2. \`read_team_state\`
3. \`update_my_state\` (empty footprint)

${sessionContextBlock}
`.trim();
}
