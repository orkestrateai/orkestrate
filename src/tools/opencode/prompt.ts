import { registerToolAdapter, type AgentContext, type ToolAdapter } from "../_base";

const TELEMETRY_HOST = "agentalk.vercel.app";

const opencodeAdapter: ToolAdapter = {
    family: "opencode",

    buildPhase0Prompt(ctx: AgentContext): string {
        return `**OpenCode Plugin Setup (one-time, automatic):**
You are running inside OpenCode. Agentalk uses the native plugin system — no background process needed.

Run **all three** commands now:

**Step 1 — Download the plugin:**
- **Windows (PowerShell):** \`New-Item -ItemType Directory -Force -Path "$HOME\\.config\\opencode\\plugins" | Out-Null; Invoke-WebRequest -Uri "https://${TELEMETRY_HOST}/tools/opencode/plugin.ts" -OutFile "$HOME\\.config\\opencode\\plugins\\agentalk.ts" -UseBasicParsing\`
- **Mac/Linux (Bash):** \`mkdir -p ~/.config/opencode/plugins && curl -sL https://${TELEMETRY_HOST}/tools/opencode/plugin.ts -o ~/.config/opencode/plugins/agentalk.ts\`

**Step 2 — Write the config file (so the plugin knows your agent identity):**
- **Windows (PowerShell):** \`Set-Content -Path "$HOME\\.config\\opencode\\.agentalk.env" -Value "AGENTALK_HOST=${ctx.host}\`nAGENTALK_AGENT_ID=${ctx.agentId}\`nAGENTALK_CLIENT=${ctx.clientId}\`nAGENTALK_ROOM=${ctx.roomId}" -Encoding utf8\`
- **Mac/Linux (Bash):** \`printf "AGENTALK_HOST=${ctx.host}\\nAGENTALK_AGENT_ID=${ctx.agentId}\\nAGENTALK_CLIENT=${ctx.clientId}\\nAGENTALK_ROOM=${ctx.roomId}\\n" > ~/.config/opencode/.agentalk.env\`

**Step 3 — Start telemetry for THIS session** (the plugin activates on next startup, so this provides telemetry now):
- **Windows (PowerShell):** \`$script = "$HOME\\\\agentalk_telemetry.js"; Invoke-WebRequest -Uri "https://${TELEMETRY_HOST}/tools/opencode/telemetry.js" -OutFile $script -UseBasicParsing; Start-Process -FilePath "node.exe" -ArgumentList @($script, "--agent=${ctx.agentId}", "--client=${ctx.clientId}", "--host=${ctx.host}", "--room=${ctx.roomId}") -NoNewWindow\`
- **Mac/Linux (Bash):** \`curl -sO https://${TELEMETRY_HOST}/tools/opencode/telemetry.js && mv telemetry.js ~/agentalk_telemetry.js && node ~/agentalk_telemetry.js --agent=${ctx.agentId} --client=${ctx.clientId} --host=${ctx.host} --room=${ctx.roomId} &\`

Future sessions will use the plugin automatically. Proceed with Phase 1 now.`;
    },
};

registerToolAdapter(opencodeAdapter);
