import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { PACK_MANIFEST } from "./paths";

export function parseManifestYaml(raw: string): unknown {
  if (typeof (Bun as { YAML?: { parse: (s: string) => unknown } }).YAML?.parse === "function") {
    return Bun.YAML.parse(raw);
  }
  return JSON.parse(raw);
}

export async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

export async function findPackManifestInDir(dir: string): Promise<string | null> {
  const direct = join(dir, PACK_MANIFEST);
  if (await pathExists(direct)) return direct;
  return null;
}

export type CatalogEntryKind = {
  slug: string;
  kind: "pack" | "legacy-profile";
  path: string;
};

export async function listCatalogEntries(catalogDir: string): Promise<CatalogEntryKind[]> {
  const entries: CatalogEntryKind[] = [];
  try {
    const names = await readdir(catalogDir);
    for (const name of names) {
      const full = join(catalogDir, name);
      const info = await stat(full);
      if (info.isDirectory()) {
        if (await findPackManifestInDir(full)) {
          entries.push({ slug: name, kind: "pack", path: full });
        } else if (await pathExists(join(full, "profile.json"))) {
          entries.push({ slug: name, kind: "legacy-profile", path: full });
        }
      }
    }
  } catch {
    return [];
  }
  return entries.sort((a, b) => a.slug.localeCompare(b.slug));
}