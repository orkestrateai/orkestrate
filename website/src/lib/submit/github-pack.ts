export type ParsedGitHubInput = {
  owner: string;
  repo: string;
  ref: string;
  packPath: string;
  webUrl: string;
};

export type PackYamlFields = {
  id: string;
  name: string;
  description: string;
  version: string;
  harness: string;
};

export type InspectedPack = {
  github: ParsedGitHubInput;
  pack: PackYamlFields;
  packYamlPath: string;
  rawUrl: string;
};

const PACK_FILE = "pack.yaml";

export function parseGitHubInput(
  inputUrl: string,
  options?: { ref?: string; packPath?: string }
): ParsedGitHubInput {
  let url: URL;
  try {
    url = new URL(inputUrl.trim());
  } catch {
    throw new Error("Enter a valid GitHub URL.");
  }

  if (url.hostname !== "github.com") {
    throw new Error("Only github.com URLs are supported.");
  }

  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length < 2) {
    throw new Error("URL must include owner and repo (e.g. github.com/org/repo).");
  }

  const owner = parts[0]!;
  const repo = parts[1]!.replace(/\.git$/, "");

  let ref = options?.ref?.trim() || "main";
  let packPath = options?.packPath?.trim() || "";

  if (parts[2] === "tree" || parts[2] === "blob") {
    ref = parts[3] ?? ref;
    const treePath = parts.slice(4).join("/");
    if (treePath.endsWith(PACK_FILE)) {
      packPath = treePath.slice(0, -PACK_FILE.length).replace(/\/$/, "");
    } else if (treePath) {
      packPath = treePath;
    }
  }

  if (options?.packPath) {
    packPath = options.packPath.trim().replace(/^\/+|\/+$/g, "");
  }

  return {
    owner,
    repo,
    ref,
    packPath: packPath.replace(/^\/+|\/+$/g, ""),
    webUrl: `https://github.com/${owner}/${repo}`,
  };
}

/** Minimal YAML parser for flat pack.yaml key: value lines. */
export function parsePackYaml(text: string): PackYamlFields {
  const fields: Record<string, string> = {};

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([a-zA-Z0-9_-]+)\s*:\s*(.+)$/);
    if (!match) continue;
    const key = match[1]!;
    let value = match[2]!.trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    fields[key] = value;
  }

  const id = fields.id?.trim();
  const name = fields.name?.trim() || id;
  const description = fields.description?.trim();
  const version = fields.version?.trim() || "0.1.0";
  const harness = fields.harness?.trim() || "opencode";

  if (!id) throw new Error("pack.yaml is missing id.");
  if (!name) throw new Error("pack.yaml is missing name.");
  if (!description || description.length < 10) {
    throw new Error("pack.yaml description must be at least 10 characters.");
  }

  return { id, name, description, version, harness };
}

function packYamlRelPath(packPath: string): string {
  return packPath ? `${packPath}/${PACK_FILE}` : PACK_FILE;
}

export function rawPackYamlUrl(github: ParsedGitHubInput): string {
  return `https://raw.githubusercontent.com/${github.owner}/${github.repo}/${github.ref}/${packYamlRelPath(github.packPath)}`;
}

export async function inspectGithubPack(
  inputUrl: string,
  options?: { ref?: string; packPath?: string }
): Promise<InspectedPack> {
  const github = parseGitHubInput(inputUrl, options);
  const packYamlPath = packYamlRelPath(github.packPath);
  const rawUrl = rawPackYamlUrl(github);

  const response = await fetch(rawUrl, {
    headers: { Accept: "text/plain", "User-Agent": "orkestrate-registry-submit" },
    next: { revalidate: 0 },
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(
        `Could not find ${packYamlPath} on branch "${github.ref}". Check the URL, branch, and pack path.`
      );
    }
    throw new Error(`GitHub returned ${response.status} while fetching pack.yaml.`);
  }

  const text = await response.text();
  const pack = parsePackYaml(text);

  return { github, pack, packYamlPath, rawUrl };
}

export function buildRegistryManifestJson(
  pack: PackYamlFields,
  github: ParsedGitHubInput
): Record<string, unknown> {
  const manifest: Record<string, unknown> = {
    id: pack.id,
    name: pack.name,
    description: pack.description,
    harness: pack.harness,
    version: pack.version,
  };

  if (github.packPath) {
    manifest.orkestrate = {
      ref: github.ref,
      packPath: github.packPath,
    };
  } else {
    manifest.orkestrate = { ref: github.ref };
  }

  return manifest;
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function validVersion(value: string): boolean {
  return /^[0-9]+(?:\.[0-9]+){0,2}(?:[-+][a-z0-9.-]+)?$/i.test(value);
}