import {
  getServerUrl,
  isToolAllowed,
  getEnabledTools,
  getDisabledTools,
} from "../lib/config.js";
import { getValidToken } from "../lib/auth.js";

/**
 * Orkestrate MCP Proxy
 *
 * Acts as a local MCP server (stdio) that forwards all requests to the
 * Orkestrate cloud MCP endpoint (HTTP), injecting the local auth token.
 */

export async function mcpCommand(opts: { parentTool?: string }) {
  const PARENT_TOOL = opts.parentTool ?? null;
  try {
    const serverUrl = getServerUrl();
    const mcpUrl = `${serverUrl}/api/mcp`;

    process.stdin.setEncoding("utf-8");
    let buffer = "";

    const startupMsg = `[Orkestrate-MCP] Starting bridge to ${mcpUrl}${PARENT_TOOL ? ` (parent: ${PARENT_TOOL})` : ""}\n`;
    process.stderr.write(startupMsg);

    process.stdin.on("data", async (chunk) => {
      const rawChunk = String(chunk);
      if (process.env.DEBUG)
        process.stderr.write(`[Orkestrate-MCP] Received chunk: ${rawChunk}\n`);
      buffer += rawChunk;

      let lineEndIndex;
      while ((lineEndIndex = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, lineEndIndex).trim();
        buffer = buffer.slice(lineEndIndex + 1);

        if (!line) continue;

        // Handle back-to-back JSON objects missing newlines
        if (line.includes("}{")) {
          const parts = line.split("}{");
          await processLine(parts[0] + "}", mcpUrl, PARENT_TOOL);
          for (let i = 1; i < parts.length - 1; i++) {
            await processLine("{" + parts[i] + "}", mcpUrl, PARENT_TOOL);
          }
          await processLine("{" + parts[parts.length - 1], mcpUrl, PARENT_TOOL);
        } else {
          await processLine(line, mcpUrl, PARENT_TOOL);
        }
      }
    });

    process.stdin.on("end", async () => {
      // Small delay to ensure last processing finishes
      await new Promise((r) => setTimeout(r, 100));
      process.exit(0);
    });

    // Stay alive
    await new Promise(() => {});
  } catch (err) {
    process.stderr.write(`[Orkestrate] Fatal error: ${err}\n`);
    process.exit(1);
  }
}

async function processLine(
  line: string,
  mcpUrl: string,
  parentTool: string | null,
) {
  if (process.env.DEBUG)
    process.stderr.write(`[Orkestrate-MCP] Processing line: ${line}\n`);
  let payload: any;
  try {
    payload = JSON.parse(line);
  } catch {
    if (process.env.DEBUG)
      process.stderr.write(`[Orkestrate-MCP] JSON Parse failed for: ${line}\n`);
    return;
  }

  const isNotification = !Object.prototype.hasOwnProperty.call(payload, "id");
  const requestId = payload.id;

  try {
    const token = await getValidToken();

    if (!token) {
      throw new Error(
        "NOT_LOGGED_IN: Please run 'orkestrate login' to authenticate.",
      );
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "User-Agent": "Orkestrate-CLI-Proxy",
    };

    // Inject parentTool into the payload so the backend can use it as the agent family
    const enrichedPayload = parentTool
      ? { ...payload, parentTool: parentTool }
      : payload;

    const res = await fetch(mcpUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(enrichedPayload),
    });

    // Notifications MUST NOT be responded to on stdout
    if (isNotification) return;

    const responseBody = await res.text();
    if (!res.ok) {
      process.stderr.write(
        `[Orkestrate-MCP] Backend error (${res.status}): ${responseBody}\n`,
      );
      if (!isNotification) {
        process.stdout.write(
          JSON.stringify({
            jsonrpc: "2.0",
            id: requestId,
            error: {
              code: -32603,
              message: `Orkestrate Cloud Error (${res.status}): ${responseBody || "Unauthorized"}. Please try 'orkestrate login'.`,
            },
          }) + "\n",
        );
      }
      return;
    }

    if (responseBody) {
      // Handle tools/list: filter tools based on user settings
      if (payload.method === "tools/list") {
        const filtered = filterToolsList(responseBody);
        process.stdout.write(filtered + "\n");
      } else {
        // Handle tools/call: check if tool is allowed
        if (payload.method === "tools/call") {
          const toolName = payload.params?.name;
          if (toolName && !isToolAllowed(toolName)) {
            process.stdout.write(
              JSON.stringify({
                jsonrpc: "2.0",
                id: requestId,
                error: {
                  code: -32600,
                  message: `Tool '${toolName}' is disabled. Use 'orkestrate tools --list' to see available tools and 'orkestrate tools --enable ${toolName}' to enable it.`,
                },
              }) + "\n",
            );
            return;
          }
        }
        process.stdout.write(responseBody + "\n");
      }
    }
  } catch (err) {
    if (isNotification) return;

    process.stdout.write(
      JSON.stringify({
        jsonrpc: "2.0",
        id: requestId,
        error: {
          code: -32603,
          message: err instanceof Error ? err.message : String(err),
        },
      }) + "\n",
    );
  }
}

/**
 * Filter tools/list response based on user tool settings
 */
function filterToolsList(responseBody: string): string {
  try {
    const parsed = JSON.parse(responseBody);
    if (!parsed.result?.tools) return responseBody;

    const enabledTools = getEnabledTools();
    const disabledTools = getDisabledTools();

    let filteredTools = parsed.result.tools;

    if (enabledTools !== null) {
      // Additive mode: only include enabled tools
      filteredTools = filteredTools.filter((tool: any) =>
        enabledTools.includes(tool.name),
      );
    } else {
      // Subtractive mode: exclude disabled tools
      filteredTools = filteredTools.filter(
        (tool: any) => !disabledTools.includes(tool.name),
      );
    }

    parsed.result.tools = filteredTools;
    return JSON.stringify(parsed);
  } catch {
    // If parsing fails, return original response
    return responseBody;
  }
}
