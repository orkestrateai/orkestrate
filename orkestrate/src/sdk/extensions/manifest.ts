export type ExtensionType = 
  | "adapter"
  | "profile-pack"
  | "skill-pack"
  | "mcp-pack"
  | "command-pack";

export interface ExtensionManifest {
  id: string;
  name: string;
  version: string;
  type: ExtensionType;
  description: string;
  author?: string;
  repository?: string;
  license?: string;
  keywords?: string[];
  
  // Entry point
  entry: string;
  
  // Type-specific fields
  harness?: string;           // for adapter type
  capabilities?: {            // for adapter type
    mcp?: boolean;
    systemPrompt?: boolean;
    skills?: boolean;
    modelSelection?: boolean;
  };
  
  profiles?: string[];        // for profile-pack type
  skills?: string[];          // for skill-pack type
  mcpServers?: string[];      // for mcp-pack type
  commands?: string[];        // for command-pack type
  
  // Dependencies
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  
  // Compatibility
  orkestrateVersion?: string;
  minOrkestrateVersion?: string;
}

export const EXTENSION_MANIFEST_SCHEMA = {
  type: "object",
  required: ["id", "name", "version", "type", "description", "entry"],
  properties: {
    id: { type: "string", pattern: "^orkestrate\\.[a-z-]+\\.[a-z0-9-]+$" },
    name: { type: "string", minLength: 1 },
    version: { type: "string", pattern: "^\\d+\\.\\d+\\.\\d+(-.*)?$" },
    type: { type: "string", enum: ["adapter", "profile-pack", "skill-pack", "mcp-pack", "command-pack"] },
    description: { type: "string", minLength: 10 },
    author: { type: "string" },
    repository: { type: "string", format: "uri" },
    license: { type: "string" },
    keywords: { type: "array", items: { type: "string" } },
    entry: { type: "string", minLength: 1 },
    harness: { type: "string" },
    capabilities: {
      type: "object",
      properties: {
        mcp: { type: "boolean" },
        systemPrompt: { type: "boolean" },
        skills: { type: "boolean" },
        modelSelection: { type: "boolean" },
      },
    },
    profiles: { type: "array", items: { type: "string" } },
    skills: { type: "array", items: { type: "string" } },
    mcpServers: { type: "array", items: { type: "string" } },
    commands: { type: "array", items: { type: "string" } },
    dependencies: { type: "object", additionalProperties: { type: "string" } },
    peerDependencies: { type: "object", additionalProperties: { type: "string" } },
    orkestrateVersion: { type: "string" },
    minOrkestrateVersion: { type: "string" },
  },
} as const;

export function validateManifest(manifest: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!manifest || typeof manifest !== "object") {
    return { valid: false, errors: ["Manifest must be an object"] };
  }
  
  const m = manifest as Record<string, unknown>;
  
  // Required fields
  for (const field of ["id", "name", "version", "type", "description", "entry"]) {
    if (!m[field] || typeof m[field] !== "string") {
      errors.push(`Missing or invalid required field: ${field}`);
    }
  }
  
  // Validate ID format
  if (m.id && typeof m.id === "string") {
    if (!/^orkestrate\.[a-z-]+\.[a-z0-9-]+$/.test(m.id)) {
      errors.push('ID must follow format: orkestrate.<category>.<name> (e.g., "orkestrate.adapter.opencode")');
    }
  }
  
  // Validate version
  if (m.version && typeof m.version === "string") {
    if (!/^\d+\.\d+\.\d+(-.*)?$/.test(m.version)) {
      errors.push('Version must follow semver (e.g., "1.0.0" or "1.0.0-beta")');
    }
  }
  
  // Validate type
  const validTypes: ExtensionType[] = ["adapter", "profile-pack", "skill-pack", "mcp-pack", "command-pack"];
  if (m.type && !validTypes.includes(m.type as ExtensionType)) {
    errors.push(`Invalid type. Must be one of: ${validTypes.join(", ")}`);
  }
  
  // Type-specific validation
  if (m.type === "adapter") {
    if (!m.harness || typeof m.harness !== "string") {
      errors.push('Adapter type requires "harness" field (e.g., "opencode")');
    }
    if (!m.capabilities || typeof m.capabilities !== "object") {
      errors.push('Adapter type requires "capabilities" object');
    }
  }
  
  if (m.type === "profile-pack") {
    if (!m.profiles || !Array.isArray(m.profiles) || m.profiles.length === 0) {
      errors.push('Profile-pack type requires non-empty "profiles" array');
    }
  }
  
  if (m.type === "skill-pack") {
    if (!m.skills || !Array.isArray(m.skills) || m.skills.length === 0) {
      errors.push('Skill-pack type requires non-empty "skills" array');
    }
  }
  
  return { valid: errors.length === 0, errors };
}

export function createManifestTemplate(type: ExtensionType): Partial<ExtensionManifest> {
  const base = {
    id: `orkestrate.${type}.my-extension`,
    name: "My Extension",
    version: "1.0.0",
    type,
    description: "A detailed description of what this extension does.",
    author: "Your Name",
    repository: "https://github.com/yourusername/your-repo",
    license: "MIT",
    keywords: ["orkestrate", type],
    entry: "index.ts",
  };
  
  switch (type) {
    case "adapter":
      return {
        ...base,
        id: "orkestrate.adapter.myharness",
        harness: "myharness",
        capabilities: {
          mcp: true,
          systemPrompt: true,
          skills: true,
          modelSelection: true,
        },
      };
    case "profile-pack":
      return {
        ...base,
        id: "orkestrate.profile-pack.mypack",
        profiles: ["profile1", "profile2"],
      };
    case "skill-pack":
      return {
        ...base,
        id: "orkestrate.skill-pack.myskills",
        skills: ["skill1", "skill2"],
      };
    case "mcp-pack":
      return {
        ...base,
        id: "orkestrate.mcp-pack.mymcps",
        mcpServers: ["server1", "server2"],
      };
    case "command-pack":
      return {
        ...base,
        id: "orkestrate.command-pack.mycommands",
        commands: ["command1", "command2"],
      };
  }
}