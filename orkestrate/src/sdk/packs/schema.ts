export type PackManifest = {
  id: string;
  name: string;
  description: string;
  version?: string;
  harness: string;
  author?: string;
  tags?: string[];
};

export type Pack = PackManifest & {
  packRoot: string;
  manifestPath: string;
};

export function assertPackId(id: string): string {
  if (!/^[a-z0-9][a-z0-9-_]*$/.test(id)) {
    throw new Error('Pack id must use lowercase letters, numbers, "-", or "_"');
  }
  return id;
}

export function parsePackManifest(value: unknown): PackManifest {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("pack.yaml must be an object");
  }
  const o = value as Record<string, unknown>;
  const id = assertPackId(String(o.id ?? o.name ?? ""));
  const name = typeof o.name === "string" && o.name.length > 0 ? o.name : id;
  const description = typeof o.description === "string" ? o.description : "";
  if (!description) {
    throw new Error('pack.yaml field "description" is required');
  }
  const harness = typeof o.harness === "string" ? o.harness : "";
  if (!harness || !/^[a-z0-9-]+$/.test(harness)) {
    throw new Error('pack.yaml field "harness" must be a lowercase harness id (e.g. opencode)');
  }
  return {
    id,
    name,
    description,
    harness,
    version: typeof o.version === "string" ? o.version : undefined,
    author: typeof o.author === "string" ? o.author : undefined,
    tags: Array.isArray(o.tags) && o.tags.every((t) => typeof t === "string") ? (o.tags as string[]) : undefined,
  };
}

export function toPack(manifest: PackManifest, packRoot: string, manifestPath: string): Pack {
  return { ...manifest, packRoot, manifestPath };
}