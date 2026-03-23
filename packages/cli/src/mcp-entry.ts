import { mcpCommand } from "./commands/mcp.js";

// Standalone MCP bridge entry point.
// DO NOT PRINT TO STDOUT ANY NON-JSON DATA.
mcpCommand({ parentTool: string }).catch((err) => {
  process.stderr.write(`[Orkestrate-MCP] Fatal: ${err}\n`);
  process.exit(1);
});
