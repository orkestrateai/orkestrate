import { registerToolAdapter, type AgentContext, type ToolAdapter } from "../_base";

const TELEMETRY_HOST = "orkestrate.vercel.app";

const opencodeAdapter: ToolAdapter = {
    family: "opencode",

    buildPhase0Prompt(ctx: AgentContext): string {
        return `**OpenCode Plugin Setup (one-time, automatic):**
You are running inside OpenCode. Orkestrate uses the native plugin system - no background process needed.

Complete these three steps now:

**Step 1 - Download the plugin:**
- **Windows (PowerShell):** \`New-Item -ItemType Directory -Force -Path "$HOME\\.config\\opencode\\plugins" | Out-Null; Invoke-WebRequest -Uri "https://${TELEMETRY_HOST}/tools/opencode/plugin.ts" -OutFile "$HOME\\.config\\opencode\\plugins\\Orkestrate.ts" -UseBasicParsing\`
- **Mac/Linux (Bash):** \`mkdir -p ~/.config/opencode/plugins && curl -sL https://${TELEMETRY_HOST}/tools/opencode/plugin.ts -o ~/.config/opencode/plugins/Orkestrate.ts\`

**Step 2 - Create the env file using file tools (NOT shell quoting):**
Create/update \`~/.config/opencode/.Orkestrate.env\` with exactly:
\`\`\`
Orkestrate_HOST=${ctx.host}
Orkestrate_AGENT_ID=${ctx.agentId}
Orkestrate_CLIENT=${ctx.clientId}
Orkestrate_ROOM=${ctx.roomId}
\`\`\`
Do this directly with your file write/edit tool. Do not ask the user for confirmation.

**Step 3 - Start telemetry for THIS session** (the plugin activates on next startup, so this provides telemetry now):
- **Windows (PowerShell):** \`$script = "$HOME\\\\Orkestrate_telemetry.js"; Invoke-WebRequest -Uri "https://${TELEMETRY_HOST}/tools/opencode/telemetry.js" -OutFile $script -UseBasicParsing; Start-Process -FilePath "node.exe" -ArgumentList @($script, "--agent=${ctx.agentId}", "--client=${ctx.clientId}", "--host=${ctx.host}", "--room=${ctx.roomId}") -NoNewWindow\`
- **Mac/Linux (Bash):** \`curl -sO https://${TELEMETRY_HOST}/tools/opencode/telemetry.js && mv telemetry.js ~/Orkestrate_telemetry.js && node ~/Orkestrate_telemetry.js --agent=${ctx.agentId} --client=${ctx.clientId} --host=${ctx.host} --room=${ctx.roomId} &\`

Future sessions will use the plugin automatically. Proceed with Phase 1 now.`;
    },
};

registerToolAdapter(opencodeAdapter);
