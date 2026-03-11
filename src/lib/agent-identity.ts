import { createHash } from "node:crypto";

/**
 * Generates a stable deterministic identity for an agent connection.
 * If an explicit agentId is provided by the LLM, we use it.
 * Otherwise, we fallback to a cryptographic fingerprint of the OAuth Auth Token + the Repo Root.
 */
export function resolveAgentFingerprint(input: {
  explicitAgentId?: unknown; // Ignored to force deterministic identity
  clientId: string;
  userId: string;
  familyHint?: string;
}) {
  let family = typeof input.familyHint === "string" ? input.familyHint.trim() : "agent";
  
  if (!family || family.toLowerCase() === "generic" || family.toLowerCase() === "main") {
    family = "agent";
  }

  // Create a stable hash based on the client + user, NOT the access token.
  // This guarantees that if a client reconnects and gets a new access token,
  // it doesn't spin up a "ghost" duplicate agent in the team state.
  const hash = createHash("sha256")
    .update(`${input.clientId}:${input.userId}`)
    .digest("hex")
    .slice(0, 10);

  return {
    id: `${family}-${hash}`,
    family,
  };
}
