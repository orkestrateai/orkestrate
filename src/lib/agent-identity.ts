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
  const sanitizedClient = clientBaseId.trim() || "unknown-client";
  const sanitizedAgent = sanitizeAgentId(agentId) || "unknown-agent";
  return `${sanitizedClient}::${sanitizedAgent}`;
}

export function getDisplayAgentIdFromScopedClientId(clientId: string): string {
  const parts = splitScopedClientId(clientId);
  return parts.scopedAgentId || parts.clientBaseId || "unknown-agent";
}

export function normalizeTelemetryScopedClientId(
  clientId: unknown,
  agent: unknown,
  clientName?: unknown,
): string {
  const parts = splitScopedClientId(clientId);
  const requestedAgent = sanitizeAgentId(agent);
  const genericRequested =
    !requestedAgent ||
    requestedAgent === "generic" ||
    requestedAgent === "agent" ||
    requestedAgent === "main";

  // If the caller passed a generic label (main/generic/agent), prefer any explicit
  // scoped suffix from clientId to avoid flipping between aliases.
  const effectiveRequestedAgent =
    genericRequested && parts.scopedAgentId ? parts.scopedAgentId : requestedAgent;

  const identity = resolveCanonicalAgentIdentity({
    requestedAgentId: effectiveRequestedAgent || requestedAgent || "main",
    clientId: parts.clientBaseId || "unknown-client",
    clientName: clientName ?? null,
  });

  return buildScopedClientId(parts.clientBaseId || "unknown-client", identity.id);
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
export function detectAgentFamily(
  clientName: unknown,
  fallbackClientId: string,
  hint?: unknown,
): string {
  const name = String(clientName || "").toLowerCase();
  const fallback = String(fallbackClientId || "").toLowerCase();
  const hintText = String(hint || "").toLowerCase();
  const combined = `${name} ${fallback} ${hintText}`;

  if (combined.includes("opencode") || combined.includes("open code")) {
    return "opencode";
  }
  if (combined.includes("codex")) return "codex";
  if (combined.includes("claude")) return "claude";
  if (combined.includes("cursor")) return "cursor";
  return "agent";
}

export function resolveCanonicalAgentIdentity(input: {
  requestedAgentId: unknown;
  clientId: string;
  clientName: unknown;
}) {
  const requested = sanitizeAgentId(input.requestedAgentId);
  const family = detectAgentFamily(
    input.clientName,
    input.clientId,
    requested || "main",
  );
  const stableFallback = sanitizeAgentId(family) || "agent";

  // Generic/Null labels COLLAPSE to the family name to prevent "main" vs "generic" dupes
  const isGeneric = !requested || requested === "generic" || requested === "agent" || requested === "main";
  const canonicalId = isGeneric ? stableFallback : requested;

  return {
    id: canonicalId,
    family,
    slotHint: requested || "main",
  };
}
