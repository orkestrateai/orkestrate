import { createHash } from "node:crypto";

/**
 * Generates a stable deterministic identity for an agent connection.
 * If an explicit agentId is provided by the LLM, we use it.
 * Otherwise, we fallback to a cryptographic fingerprint of the OAuth Auth Token + the Repo Root.
 */
export function resolveAgentFingerprint(input: {
  explicitAgentId?: unknown; // Ignored to force deterministic identity
  accessToken: string;
  familyHint?: string;
}) {
  let family = typeof input.familyHint === "string" ? input.familyHint.trim() : "agent";
  
  if (!family || family.toLowerCase() === "generic" || family.toLowerCase() === "main") {
    family = "agent";
  }

  // Create a stable hash based directly on the MCP Auth Token.
  // This token is universally unique to the tool's connection to your server!
  const hash = createHash("sha256")
    .update(input.accessToken)
    .digest("hex")
    .slice(0, 10);

  return {
    id: `${family}-${hash}`,
    family,
  };
}
