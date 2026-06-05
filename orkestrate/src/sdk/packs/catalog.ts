import { join } from "node:path";
import type { Pack } from "./schema";
import { toPack, parsePackManifest } from "./schema";
import { listCatalogEntries, pathExists, parseManifestYaml } from "./fs";
import { bundledCatalogDir, installPackFromDirectory, listInstalledPacks } from "./store";
import { workspacePacksDir, globalPacksDir, PACK_MANIFEST } from "./paths";
import { fetchRegistryPackItems, type RegistryItem } from "./registry";
import {
  installPackFromGitHub,
  parseRegistryMeta,
  resolveGitHubFromRegistryItem,
} from "./github";

export type CatalogEntry = {
  slug: string;
  pack: Pack;
  installed: boolean;
  source: "bundled" | "registry";
  description?: string;
  github?: string;
};

async function isPackInstalled(packId: string): Promise<boolean> {
  if (await pathExists(join(workspacePacksDir, packId, PACK_MANIFEST))) return true;
  if (await pathExists(join(globalPacksDir, packId, PACK_MANIFEST))) return true;
  return false;
}

async function loadBundledEntry(slug: string, path: string): Promise<CatalogEntry> {
  const manifestPath = join(path, PACK_MANIFEST);
  const raw = await Bun.file(manifestPath).text();
  const manifest = parsePackManifest(parseManifestYaml(raw));
  const pack = toPack(manifest, path, manifestPath);
  return {
    slug,
    pack,
    installed: await isPackInstalled(pack.id),
    source: "bundled",
  };
}

function registryEntryToCatalog(item: RegistryItem): CatalogEntry | null {
  const manifest = item.manifest_json;
  if (manifest && typeof manifest === "object" && !Array.isArray(manifest)) {
    const o = manifest as Record<string, unknown>;
    if (typeof o.id === "string" && typeof o.harness === "string") {
      try {
        const parsed = parsePackManifest(manifest);
        const pack = toPack(parsed, item.source_url, item.source_url);
        const gh = resolveGitHubFromRegistryItem(item);
        return {
          slug: item.slug,
          pack,
          installed: false,
          source: "registry",
          description: item.description,
          github: `${gh.owner}/${gh.repo}@${gh.ref}${gh.packPath ? `/${gh.packPath}` : ""}`,
        };
      } catch {
        // fall through — install uses GitHub tree
      }
    }
  }

  const pack = toPack(
    {
      id: item.slug,
      name: item.name,
      description: item.description,
      harness: "opencode",
      version: item.version,
    },
    item.source_url,
    item.source_url
  );
  const gh = resolveGitHubFromRegistryItem(item);
  return {
    slug: item.slug,
    pack,
    installed: false,
    source: "registry",
    description: item.description,
    github: `${gh.owner}/${gh.repo}@${gh.ref}${gh.packPath ? `/${gh.packPath}` : ""}`,
  };
}

export async function listBundledCatalog(): Promise<CatalogEntry[]> {
  const entries = await listCatalogEntries(bundledCatalogDir);
  const results: CatalogEntry[] = [];
  for (const entry of entries) {
    if (entry.kind !== "pack") continue;
    results.push(await loadBundledEntry(entry.slug, entry.path));
  }
  return results;
}

export async function listRegistryCatalog(): Promise<CatalogEntry[]> {
  let items: RegistryItem[];
  try {
    items = await fetchRegistryPackItems();
  } catch (error) {
    console.warn(error instanceof Error ? error.message : String(error));
    return [];
  }

  const results: CatalogEntry[] = [];
  for (const item of items) {
    const entry = registryEntryToCatalog(item);
    if (!entry) continue;
    entry.installed = await isPackInstalled(entry.pack.id);
    results.push(entry);
  }
  return results;
}

/** Bundled packs first, then registry (dedupe by pack id). */
export async function listFullCatalog(): Promise<CatalogEntry[]> {
  const [bundled, remote] = await Promise.all([listBundledCatalog(), listRegistryCatalog()]);
  const seen = new Set<string>();
  const merged: CatalogEntry[] = [];
  for (const entry of [...bundled, ...remote]) {
    if (seen.has(entry.pack.id)) continue;
    seen.add(entry.pack.id);
    merged.push(entry);
  }
  return merged.sort((a, b) => a.pack.id.localeCompare(b.pack.id));
}

export async function installCatalogPack(
  slug: string,
  options?: { target?: "workspace" | "global"; overwrite?: boolean }
): Promise<Pack> {
  const safeSlug = slug.replace(/[^a-z0-9-_]/gi, "");

  const entries = await listCatalogEntries(bundledCatalogDir);
  const hit = entries.find((e) => e.slug === safeSlug || e.slug === slug);
  if (hit?.kind === "pack") {
    return installPackFromDirectory(hit.path, {
      target: options?.target ?? "workspace",
      overwrite: options?.overwrite,
    });
  }

  let items: RegistryItem[];
  try {
    items = await fetchRegistryPackItems();
  } catch (error) {
    throw new Error(
      `Pack "${slug}" is not bundled and registry is unavailable: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  const item = items.find((i) => i.slug === slug || i.slug === safeSlug);
  if (!item) {
    throw new Error(`Pack "${slug}" not found in bundled catalog or registry.`);
  }

  const gh = resolveGitHubFromRegistryItem(item);
  const meta = parseRegistryMeta(item.manifest_json);

  return installPackFromGitHub(item.source_url, {
    ref: meta.ref ?? gh.ref,
    packPath: meta.packPath ?? gh.packPath,
    slug: item.slug,
    target: options?.target,
    overwrite: options?.overwrite,
  });
}

export { listInstalledPacks, seedBundledToGlobalIfMissing } from "./store";