export type ScopedClientParts = {
  rawClientId: string;
  clientBaseId: string;
  scopedAgentId: string | null;
};

export function sanitizeAgentId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return null;
  const normalized = trimmed.replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  if (!normalized) return null;
  return normalized.slice(0, 24);
}

export function splitScopedClientId(clientId: unknown): ScopedClientParts {
  const raw = typeof clientId === "string" ? clientId : "";
  const parts = raw.split("::");
  if (parts.length > 1) {
    return {
      rawClientId: raw,
      clientBaseId: parts[0] || "",
      scopedAgentId: parts.slice(1).join("::") || null,
    };
  }
  return {
    rawClientId: raw,
    clientBaseId: raw,
    scopedAgentId: null,
  };
}

export function buildScopedClientId(clientBaseId: string, agentId: string): string {
  return `${clientBaseId}::${agentId}`;
}

export function getDisplayAgentIdFromScopedClientId(clientId: string): string {
  const parts = splitScopedClientId(clientId);
  return parts.scopedAgentId || parts.clientBaseId || "unknown-agent";
}

export function normalizeTelemetryScopedClientId(clientId: unknown, agent: unknown): string {
  const parts = splitScopedClientId(clientId);
  const normalizedAgent = sanitizeAgentId(agent) || parts.scopedAgentId || "unknown-agent";
  return buildScopedClientId(parts.clientBaseId || "unknown-client", normalizedAgent);
}

export function telemetryClientIdCandidates(clientId: unknown, agent?: unknown): string[] {
  const parts = splitScopedClientId(clientId);
  const normalizedAgent = sanitizeAgentId(agent);
  const candidates = new Set<string>();
  if (parts.rawClientId) candidates.add(parts.rawClientId);
  if (parts.clientBaseId) candidates.add(parts.clientBaseId);
  if (parts.clientBaseId && normalizedAgent) {
    candidates.add(buildScopedClientId(parts.clientBaseId, normalizedAgent));
  }
  if (parts.clientBaseId) {
    candidates.add(`${parts.clientBaseId}::`);
  }
  return Array.from(candidates);
}
