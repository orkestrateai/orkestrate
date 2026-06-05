export type McpServerConfig = {
  id: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
};

export type Profile = {
  name: string;
  description: string;
  harness: string;
  author?: string;
  tags?: string[];
  version?: string;
  sourcePath?: string;
  /** Directory containing profile.json and bundled skills/plugins/scaffold */
  packRoot?: string;
  info: string;
  config: Record<string, any>;

  // Optional fields for backward compatibility / type convenience in CLI / adapters
  workspace?: {
    root: string;
    policy: "current-directory" | "custom";
  };
  model?: {
    provider: string;
    id: string;
    thinking?: string;
    cycle?: string[];
  };
  prompt?: string;
  resources?: {
    skills?: string[];
    prompts?: string[];
    extensions?: string[];
    mcpServers?: McpServerConfig[];
  };
  tools?: {
    allow?: string[];
    deny?: string[];
  };
  session?: {
    dir: string;
  };
  env?: Record<string, string>;
  harnessConfig?: Record<string, any>;
};

export type ProfileParseWarning = {
  field: string;
  message: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Profile field "${field}" must be a non-empty string`);
  }
  return value;
}

function assertStringArray(value: unknown, field: string): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    throw new Error(`Profile field "${field}" must be an array of strings`);
  }
  return value;
}

function assertWorkspacePolicy(value: unknown, field: string): "current-directory" | "custom" {
  if (value === "current-directory" || value === "custom") {
    return value;
  }
  throw new Error(`Profile field "${field}" must be "current-directory" or "custom"`);
}

function assertHarnessName(value: unknown, field: string): string {
  const raw = isRecord(value) && typeof value.adapter === "string" ? value.adapter : value;
  const str = assertString(raw, field);
  if (!/^[a-z0-9-]+$/.test(str)) {
    throw new Error(`Profile field "${field}" must contain only lowercase letters, numbers, and dashes`);
  }
  return str;
}

function assertProfileNameValue(value: unknown, field: string): string {
  const str = assertString(value, field);
  if (!/^[a-z0-9][a-z0-9-_]*$/.test(str)) {
    throw new Error('Profile name must use lowercase letters, numbers, "-", or "_"');
  }
  return str;
}

export function parseProfile(value: unknown, warn?: (warning: ProfileParseWarning) => void): Profile {
  if (!isRecord(value)) {
    throw new Error("Profile must be an object");
  }

  const name = assertProfileNameValue(value.name, "name");
  const description = assertString(value.description, "description");
  const harness = assertHarnessName(value.harness, "harness");
  const info = assertString(value.info, "info");

  const author = typeof value.author === "string" ? value.author : undefined;
  const version = typeof value.version === "string" ? value.version : undefined;
  const tags = Array.isArray(value.tags) && value.tags.every((t) => typeof t === "string")
    ? (value.tags as string[])
    : undefined;

  let config: Record<string, any> = {};
  if (isRecord(value.config)) {
    config = value.config;
  }

  // Populate config from legacy top-level fields if config is empty
  if (Object.keys(config).length === 0) {
    const legacyKeys = ["workspace", "model", "prompt", "resources", "tools", "session", "env", "harnessConfig"];
    for (const key of legacyKeys) {
      if (key in value) {
        config[key] = value[key];
      }
    }
  }

  const profile: Profile = {
    name,
    description,
    harness,
    info,
    author,
    tags,
    version,
    config,
  };

  // Optional typing fields mapping for convenience/backward compatibility
  const configWorkspace = config.workspace || value.workspace;
  if (isRecord(configWorkspace)) {
    profile.workspace = {
      root: typeof configWorkspace.root === "string" ? configWorkspace.root : ".",
      policy: assertWorkspacePolicy(configWorkspace.policy || "current-directory", "workspace.policy"),
    };
  }

  const configModel = config.model || value.model;
  if (isRecord(configModel)) {
    profile.model = {
      provider: typeof configModel.provider === "string" ? configModel.provider : "default",
      id: typeof configModel.id === "string" ? configModel.id : "default",
      thinking: typeof configModel.thinking === "string" ? configModel.thinking : undefined,
      cycle: Array.isArray(configModel.cycle) ? assertStringArray(configModel.cycle, "model.cycle") : undefined,
    };
  }

  const configPrompt = config.prompt || value.prompt;
  if (typeof configPrompt === "string") {
    profile.prompt = configPrompt;
  }

  const configResources = config.resources || value.resources;
  if (isRecord(configResources)) {
    profile.resources = {
      skills: assertStringArray(configResources.skills, "resources.skills"),
      prompts: assertStringArray(configResources.prompts, "resources.prompts"),
      extensions: assertStringArray(configResources.extensions, "resources.extensions"),
      mcpServers: (configResources.mcpServers as McpServerConfig[]) || [],
    };
  }

  const configTools = config.tools || value.tools;
  if (isRecord(configTools)) {
    profile.tools = {
      allow: assertStringArray(configTools.allow, "tools.allow"),
      deny: assertStringArray(configTools.deny, "tools.deny"),
    };
  }

  const configSession = config.session || value.session;
  if (isRecord(configSession)) {
    profile.session = {
      dir: typeof configSession.dir === "string" ? configSession.dir : "",
    };
  }

  const configEnv = config.env || value.env;
  if (isRecord(configEnv)) {
    profile.env = configEnv as Record<string, string>;
  }

  const configHarnessConfig = config.harnessConfig || value.harnessConfig;
  if (isRecord(configHarnessConfig)) {
    profile.harnessConfig = configHarnessConfig;
  }

  return profile;
}

