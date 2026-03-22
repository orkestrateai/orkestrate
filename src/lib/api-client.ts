// src/lib/api-client.ts
// Typed client for all dashboard API endpoints.

export interface Workspace {
  id: string;
  name: string;
  ownerUserId: string;
  repoUrl: string | null;
  defaultBranch: string | null;
  maxAgents: number;
  maxMembers: number;
  createdAt: string;
  updatedAt: string;
}

export interface Member {
  id: string;
  workspaceId: string;
  userId: string;
  role: "owner" | "admin" | "member";
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  email?: string;
  displayName?: string;
}

export interface Agent {
  id: string;
  toolName: string;
  label: string;
  status: string;
  lastMessageAt: string;
  currentBranch: string | null;
}

export interface AgentState {
  objective: string;
  footprint: string[];
  plan: string[];
  completed: string[];
  notes: string;
  version: string;
  gitBranch: string | null;
  gitHeadSha: string | null;
}

export interface KnowledgeDoc {
  id: string;
  workspaceId: string;
  title: string;
  description: string;
  content: string;
  parentId: string | null;
  isFolder: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Subscription {
  planType: string;
  status: string;
  currentPeriodEnd: string | null;
}

export interface GitRepo {
  fullName: string;
  name: string;
  owner: string;
  defaultBranch: string;
  private: boolean;
}

export interface GitBranch {
  name: string;
  isDefault: boolean;
}

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `API error ${res.status}`);
  }
  return res.json();
}

// ── Workspaces ──────────────────────────────────────────────

export const workspacesApi = {
  list: () => apiFetch<{ workspaces: Workspace[] }>("/api/workspaces"),

  create: (name: string) =>
    apiFetch<{ workspace: Workspace }>("/api/workspaces", {
      method: "POST",
      body: JSON.stringify({ action: "create", name }),
    }),

  rename: (workspaceId: string, name: string) =>
    apiFetch<{ ok: boolean }>("/api/workspaces", {
      method: "POST",
      body: JSON.stringify({ action: "rename", workspaceId, name }),
    }),

  remove: (workspaceId: string) =>
    apiFetch<{ ok: boolean }>("/api/workspaces", {
      method: "POST",
      body: JSON.stringify({ action: "delete", workspaceId }),
    }),

  switch: (workspaceId: string) =>
    apiFetch<{ ok: boolean }>("/api/workspaces", {
      method: "POST",
      body: JSON.stringify({ action: "switch", workspaceId }),
    }),

  bindRepo: (workspaceId: string, repoUrl: string, branch?: string) =>
    apiFetch<{ ok: boolean }>("/api/workspaces", {
      method: "POST",
      body: JSON.stringify({ action: "bind-repo", workspaceId, repoUrl, branch }),
    }),
};

// ── Members ─────────────────────────────────────────────────

export const membersApi = {
  list: (workspaceId: string) =>
    apiFetch<{ members: Member[] }>(`/api/workspace-members?workspaceId=${workspaceId}`),
};

// ── Knowledge Base ──────────────────────────────────────────

export const knowledgeApi = {
  list: (workspaceId: string, parentId?: string | null) => {
    const params = new URLSearchParams({ workspaceId });
    if (parentId !== undefined) params.set("parentId", parentId ?? "null");
    return apiFetch<{ docs: KnowledgeDoc[] }>(`/api/knowledge?${params}`);
  },

  get: (id: string, workspaceId: string) =>
    apiFetch<{ doc: KnowledgeDoc }>(`/api/knowledge?id=${id}&workspaceId=${workspaceId}`),

  create: (data: { workspaceId: string; title: string; description?: string; content?: string; parentId?: string | null; isFolder?: boolean }) =>
    apiFetch<{ doc: KnowledgeDoc }>("/api/knowledge", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (data: { id: string; workspaceId: string; title?: string; description?: string; content?: string; parentId?: string | null }) =>
    apiFetch<{ doc: KnowledgeDoc }>("/api/knowledge", {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  remove: (id: string, workspaceId: string) =>
    apiFetch<{ ok: boolean }>(`/api/knowledge?id=${id}&workspaceId=${workspaceId}`, {
      method: "DELETE",
    }),
};

// ── Payments ────────────────────────────────────────────────

export const paymentsApi = {
  status: () => apiFetch<Subscription>("/api/payments/status"),

  createSubscription: (planType: string) =>
    apiFetch<{ subscriptionId: string }>("/api/payments/create-subscription", {
      method: "POST",
      body: JSON.stringify({ planType }),
    }),

  verify: (data: Record<string, string>) =>
    apiFetch<{ ok: boolean }>("/api/payments/verify", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

// ── Git ─────────────────────────────────────────────────────

export const gitApi = {
  repos: () => apiFetch<{ repos: GitRepo[] }>("/api/git/repos"),

  branches: (owner: string, repo: string) =>
    apiFetch<{ branches: GitBranch[] }>(`/api/git/branches?owner=${owner}&repo=${repo}`),
};
