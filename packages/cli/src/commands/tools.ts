import {
  getEnabledTools,
  getDisabledTools,
  enableTool,
  disableTool,
  isToolAllowed,
} from "../lib/config.js";
import { ui } from "../lib/ui.js";

interface ToolsCommandOptions {
  list?: boolean;
  enable?: string;
  disable?: string;
}

export async function toolsCommand(opts: ToolsCommandOptions) {
  const { list, enable, disable } = opts;

  // --list: show current settings
  if (list) {
    const enabledTools = getEnabledTools();
    const disabledTools = getDisabledTools();

    ui.header("Tool Filter Settings");

    if (enabledTools !== null) {
      ui.info(`Mode: Additive (only listed tools are enabled)`);
      if (enabledTools.length === 0) {
        ui.dim("  No tools enabled");
      } else {
        enabledTools.forEach((tool) => {
          ui.success(tool);
        });
      }
    } else {
      ui.info(`Mode: Subtractive (all tools except disabled)`);
      if (disabledTools.length === 0) {
        ui.dim("  No tools disabled");
      } else {
        disabledTools.forEach((tool) => {
          ui.error(tool);
        });
      }
    }

    console.log();
    ui.dim(`  Use 'orkestrate tools --enable <tool>' to enable a tool`);
    ui.dim(`  Use 'orkestrate tools --disable <tool>' to disable a tool`);
    return;
  }

  // --enable <tool>
  if (enable) {
    const toolName = enable;
    if (isToolAllowed(toolName)) {
      ui.warn(`Tool '${toolName}' is already enabled`);
    } else {
      enableTool(toolName);
      ui.success(`Enabled tool: ${toolName}`);
    }
    return;
  }

  // --disable <tool>
  if (disable) {
    const toolName = disable;
    if (!isToolAllowed(toolName)) {
      ui.warn(`Tool '${toolName}' is already disabled`);
    } else {
      disableTool(toolName);
      ui.success(`Disabled tool: ${toolName}`);
    }
    return;
  }

  // No options: show help
  ui.header("Orkestrate Tools Management");
  ui.info("Manage which tools are available through the local MCP proxy");
  console.log();
  ui.dim("Usage:");
  ui.dim("  orkestrate tools --list              Show current settings");
  ui.dim("  orkestrate tools --enable <tool>     Enable a specific tool");
  ui.dim("  orkestrate tools --disable <tool>    Disable a specific tool");
}
