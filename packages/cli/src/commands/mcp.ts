
import { getServerUrl } from "../lib/config.js";
import { getValidToken } from "../lib/auth.js";

/**
 * Orkestrate MCP Proxy
 * 
 * Acts as a local MCP server (stdio) that forwards all requests to the 
 * Orkestrate cloud MCP endpoint (HTTP), injecting the local auth token.
 */
export async function mcpCommand() {
  try {
    const serverUrl = getServerUrl();
    const mcpUrl = `${serverUrl}/api/mcp`;

    process.stdin.setEncoding("utf-8");
    let buffer = "";

    process.stderr.write(`[Orkestrate-MCP] Starting bridge to ${mcpUrl}\n`);

    process.stdin.on("data", async (chunk) => {
      const rawChunk = String(chunk);
      if (process.env.DEBUG) process.stderr.write(`[Orkestrate-MCP] Received chunk: ${rawChunk}\n`);
      buffer += rawChunk;
      
      let lineEndIndex;
      while ((lineEndIndex = buffer.indexOf("\n")) >= 0) {
        let line = buffer.slice(0, lineEndIndex).trim();
        buffer = buffer.slice(lineEndIndex + 1);
        
        if (!line) continue;
        
        // Handle back-to-back JSON objects missing newlines
        if (line.includes("}{")) {
           const parts = line.split("}{");
           await processLine(parts[0] + "}", mcpUrl);
           for (let i = 1; i < parts.length - 1; i++) {
             await processLine("{" + parts[i] + "}", mcpUrl);
           }
           await processLine("{" + parts[parts.length - 1], mcpUrl);
        } else {
           await processLine(line, mcpUrl);
        }
      }
    });

    process.stdin.on("end", async () => {
      // Small delay to ensure last processing finishes
      await new Promise(r => setTimeout(r, 100));
      process.exit(0);
    });

    // Stay alive
    await new Promise(() => {});
  } catch (err) {
    process.stderr.write(`[Orkestrate] Fatal error: ${err}\n`);
    process.exit(1);
  }
}

async function processLine(line: string, mcpUrl: string) {
    if (process.env.DEBUG) process.stderr.write(`[Orkestrate-MCP] Processing line: ${line}\n`);
    let payload: any;
    try {
        payload = JSON.parse(line);
    } catch { 
        if (process.env.DEBUG) process.stderr.write(`[Orkestrate-MCP] JSON Parse failed for: ${line}\n`);
        return; 
    }

    const isNotification = !Object.prototype.hasOwnProperty.call(payload, "id");
    const requestId = payload.id;

    try {
        const token = await getValidToken();
        
        if (!token) {
           throw new Error("NOT_LOGGED_IN: Please run 'orkestrate login' to authenticate.");
        }

        const res = await fetch(mcpUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
                "User-Agent": "Orkestrate-CLI-Proxy"
            },
            body: line
        });

        // Notifications MUST NOT be responded to on stdout
        if (isNotification) return;

        const responseBody = await res.text();
        if (!res.ok) {
            process.stderr.write(`[Orkestrate-MCP] Backend error (${res.status}): ${responseBody}\n`);
            if (!isNotification) {
                process.stdout.write(JSON.stringify({
                    jsonrpc: "2.0",
                    id: requestId,
                    error: {
                        code: -32603,
                        message: `Orkestrate Cloud Error (${res.status}): ${responseBody || "Unauthorized"}. Please try 'orkestrate login'.`
                    }
                }) + "\n");
            }
            return;
        }
        
        if (responseBody) {
            process.stdout.write(responseBody + "\n");
        }
    } catch (err) {
        if (isNotification) return;

        process.stdout.write(JSON.stringify({
            jsonrpc: "2.0",
            id: requestId,
            error: {
                code: -32603,
                message: err instanceof Error ? err.message : String(err)
            }
        }) + "\n");
    }
}
