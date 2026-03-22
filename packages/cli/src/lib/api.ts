/**
 * Orkestrate CLI — API Client
 *
 * Authenticated HTTP client for the Orkestrate web API.
 * All requests use the stored OAuth bearer token.
 */

import { getServerUrl } from "./config.js";
import { getValidToken } from "./auth.js";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getValidToken();
  if (!token) {
    throw new ApiError(401, "Not authenticated. Run `orkestrate login` first.");
  }
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const serverUrl = getServerUrl();
  const headers = await authHeaders();

  // Debug (masked token)
  const token = headers["Authorization"]?.split(" ")[1] || "";
  const maskedToken =
    token.length > 10 ? `${token.slice(0, 5)}...${token.slice(-5)}` : "***";

  if (process.env.DEBUG) {
    console.error(`[DEBUG] API Request: ${method} ${serverUrl}${path}`);
    console.error(`[DEBUG] Token: ${maskedToken} (len: ${token.length})`);
  }

  const res = await fetch(`${serverUrl}${path}`, {
    method,
    headers: {
      ...headers,
      Accept: "application/json",
      "User-Agent": "Orkestrate-CLI-v1",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new ApiError(res.status, `API error (${res.status}): ${text}`);
  }

  return (await res.json()) as T;
}

// --- User API ---

export interface UserInfo {
  id: string;
  email: string;
}

export async function getMe(): Promise<UserInfo> {
  const data = await request<{ user: UserInfo }>("GET", "/api/auth/me");
  return data.user;
}

// --- GitHub API ---

export async function getGithubStatus(): Promise<{ connected: boolean }> {
  const data = await request<{ connected: boolean }>(
    "GET",
    "/api/github/status",
  );
  return { connected: Boolean(data.connected) };
}

// --- Workspace API ---

export interface Workspace {
  id: string;
  name: string;
  ownerId: string;
  repoUrl: string | null;
  defaultBranch: string | null;
  isActive: boolean;
  createdAt: string;
}

export async function listWorkspaces(): Promise<Workspace[]> {
  const data = await request<{ workspaces: Workspace[] }>(
    "GET",
    "/api/workspaces",
  );
  return data.workspaces || [];
}

export async function switchWorkspace(workspaceId: string): Promise<void> {
  await request("POST", "/api/workspaces", {
    action: "switch",
    workspaceId,
  });
}

export async function createWorkspace(
  name: string,
  repoUrl: string,
  defaultBranch: string,
): Promise<Workspace> {
  const data = await request<{ workspace: Workspace }>(
    "POST",
    "/api/workspaces",
    {
      action: "create",
      name,
      repoUrl,
      defaultBranch,
    },
  );
  return data.workspace;
}

// --- Agent Status API ---

export interface AgentState {
  scopedAgentId: string;
  agentId: string;
  toolName: string | null;
  status: string;
  objective: string;
  claimedPaths: string[];
  plan: string[];
  notes: string;
  updatedAt: string;
}

export async function getTeamStatus(): Promise<{
  agents: AgentState[];
  stateHash: string;
}> {
  // Use the MCP endpoint with a read_team_state RPC call
  const serverUrl = getServerUrl();
  const token = await getValidToken();
  if (!token) {
    throw new ApiError(401, "Not authenticated. Run `orkestrate login` first.");
  }

  const res = await fetch(`${serverUrl}/api/mcp`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: "read_team_state",
        arguments: {},
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new ApiError(res.status, `MCP error (${res.status}): ${text}`);
  }

  const rpcResult = (await res.json()) as any;

  // Parse the MCP response to extract team state
  if (rpcResult.error) {
    throw new ApiError(400, rpcResult.error.message || "MCP call failed");
  }

  const content = rpcResult.result?.content || [];
  const textContent = content
    .filter((c: { type: string }) => c.type === "text")
    .map((c: { text: string }) => c.text)
    .join("\n");

  try {
    const parsed = JSON.parse(textContent);
    return {
      agents: parsed.agents || parsed.states || [],
      stateHash: parsed.stateHash || "",
    };
  } catch {
    return { agents: [], stateHash: "" };
  }
}

// --- Health Check ---

export async function checkHealth(): Promise<boolean> {
  const serverUrl = getServerUrl();
  try {
    const res = await fetch(`${serverUrl}/api/health`, { method: "GET" });
    return res.ok;
  } catch {
    return false;
  }
}
