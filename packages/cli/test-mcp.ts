
import { getCredentials } from "./src/lib/config.js";

async function testMcp() {
  const creds = getCredentials();
  if (!creds || !creds.accessToken) {
    console.error("No access token found. Run orkestrate login first.");
    return;
  }

  const mcpUrl = "https://orkestrate.space/api/mcp";
  const token = creds.accessToken;

  console.log(`Testing MCP with token: ${token.slice(0, 5)}...`);

  const response = await fetch(mcpUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "listTools",
      params: {}
    })
  });

  const body = await response.json();
  console.log("Response:", JSON.stringify(body, null, 2));
}

testMcp();
