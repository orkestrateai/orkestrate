
import { mcpCommand } from "./src/commands/mcp.js";
import { ui } from "./src/lib/ui.js";

// Minimal entry point for MCP to avoid any global Commander/Banner logic
mcpCommand().catch(err => {
    process.stderr.write(`[Orkestrate-Standalone] Fatal: ${err}\n`);
    process.exit(1);
});
