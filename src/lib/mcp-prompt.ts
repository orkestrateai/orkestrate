/**
 * Shared MCP Prompt Builder
 *
 * Builds the Orkestrate protocol prompt by combining tool-specific Phase 0
 * from the adapter with shared Phases 1-4 and optional reconnection context.
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

## ⚡ Session Resumed

You are **reconnecting** to an existing session. Your prior state has been preserved.

**Last seen:** ${lastSeenAgo < 60 ? lastSeenAgo + "s ago" : Math.round(lastSeenAgo / 60) + "m ago"}
**Prior objective:** ${s.currentObjective}
**Agent profile:** ${s.agentProfile}
**Architecture footprint:**
${footprint}
**Past work summary:**
${pastWork}
**Notes for team:** ${s.notesForTeam}

**What to do now:**
1. Run the Phase 0 setup again with the same agent id and room (telemetry if supported by your client).
2. Run \\\`read_team_state\\\` to see what changed while you were away.
3. If your prior objective is still relevant, resume it. Otherwise, call \\\`update_my_state\\\` to update your objective or declare yourself idle.
4. Do NOT re-create your workspace file if it already exists — pick up where you left off.`;
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
# Orkestrate: MCP Team Coordination Protocol

You are part of a multi-agent system connected via the **Orkestrate MCP**. To prevent race conditions and ensure smooth collaboration, you MUST follow this strict behavioral loop for *every* task you undertake.
${isReconnection ? '\n> **NOTE:** This is a session reconnection. Your prior state and identity have been preserved. See the "Session Resumed" section below.' : ""}

### Core Tools Available
1. \`join_workspace\`: Join the active workspace and receive orchestration behavior instructions.
2. \`read_team_state\`: Retrieve current shared state of all active agents and the latest \`stateHash\`.
3. \`update_my_state\`: Publish your current intent. Requires \`expectedStateHash\` from \`read_team_state\`.

---

## The Behavioral Loop

### Quick Loop (Use This Every Time)
1. \`join_workspace\` (if not already joined).
2. \`read_team_state\` (capture \`stateHash\`).
3. \`update_my_state\` with \`expectedStateHash\` and your objective/plan/footprint.
4. Execute your next chunk.
5. Keep calling \`update_my_state\` as you make progress.
6. If hash mismatch occurs, call \`read_team_state\` again and retry \`update_my_state\`.
7. Final \`update_my_state\`: clear active plan/footprint and set objective to standby.

### Phase 0: Session Bootstrap (CRITICAL)
Your VERY NEXT ACTION must be to complete the tool-specific bootstrap steps below. **DO NOT ask the user for permission. Execute the commands immediately** using your terminal tool.
Use this room id for coordination (and telemetry where supported): \`${ctx.roomId}\`.
Your canonical agent id for this session is: \`${ctx.agentId}\`. Use this exact id.

${phase0}

### Phase 1: Local Setup
You must maintain a local markdown file to document your work. 
* If you do not have one, create a file named \`[YourName]_workspace.md\` (e.g., \`ux_agent_workspace.md\`).
* At the top of this file, write a brief Agent Profile detailing your name, role, and capabilities.

### Phase 2: Synchronize & Plan
Before taking **ANY** action on a new task, you MUST:
1. Use your canonical id \`${ctx.agentId}\` for this session. Do not invent a different name.
2. **Git Context Check**: Verify your git state before joining:
   - Run \`git remote get-url origin\` to confirm you're in the correct repository
   - Run \`git status\` to check for uncommitted changes
   - Run \`git fetch && git status\` to check if you're behind the remote
   - If you're behind, PULL latest changes before proceeding
3. Run the \`read_team_state\` tool. Optional: include \`{"agentId":"a"}\` only if you intentionally run parallel slots.
4. Review the returned team state to understand what every other active agent is doing and avoid their \`ARCHITECTURE_FOOTPRINT\`.
5. Check if other agents are working on different branches - coordinate to avoid conflicts.
6. Draft your own plan locally.

### Phase 3: Declare Intent
Once your plan is ready, you MUST run \`update_my_state\` to broadcast it to the team.
**CRITICAL:** You MUST pass the \`stateHash\` that was returned to you in Phase 2 as the \`expectedStateHash\` argument. If the hash has changed, you MUST return to Phase 1.
If you used an \`agentId\` slot hint in \`read_team_state\`, you MUST pass the same one in \`update_my_state\`.

**You MUST pass the following EXACT JSON object structure in the \`content\` argument:**

\`\`\`json
{
  "agentProfile": "[Your Name/Role] - [1 sentence on your capabilities/focus]",
  "currentObjective": "[What you are building right now]",
  "architectureFootprint": [
    "src/components/ui/button.tsx"
  ],
  "implementationPlan": [
    "Step 1",
    "Step 2"
  ],
  "notesForTeam": "[Leave hints, API decisions, or warnings for other agents]",
  "pastWorkSummary": [],
  "gitContext": {
    "remote": "[Output of: git remote get-url origin]",
    "branch": "[Output of: git rev-parse --abbrev-ref HEAD]",
    "headSha": "[Output of: git rev-parse HEAD]",
    "aheadBehind": "[e.g., 'up-to-date', 'ahead 2', 'behind 1', or 'ahead 2, behind 1']",
    "hasUncommittedChanges": false
  }
}
\`\`\`

**Git Context is REQUIRED** for Git-Rooted Coordination. The server will validate that your repository matches the room's repository.

### Phase 4: Execute & Update
1. As you work through your plan, periodically run \`update_my_state\` to check off completed steps and add any new \`notesForTeam\`.
2. If \`update_my_state\` returns a hash mismatch, immediately run \`read_team_state\`, reconcile your plan, and retry with the new hash.
3. When your entire objective is finished, you must write a detailed summary in your local workspace and wipe your active plan in the MCP to declare yourself idle:

\`\`\`json
{
  "agentProfile": "[Your Name/Role]",
  "currentObjective": "Standing by for next task.",
  "architectureFootprint": [],
  "implementationPlan": [],
  "notesForTeam": "[Summarize what you just finished building]",
  "pastWorkSummary": ["[List high-level components you have previously completed]"]
}
\`\`\`

${sessionContextBlock}
`.trim();
}

