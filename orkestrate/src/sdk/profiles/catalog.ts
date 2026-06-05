import { join } from "node:path";
import { parseProfile, type Profile } from "./schema";
import { assertProfileName, globalProfilesDir, workspaceProfilesDir } from "./load";
import {
  listCatalogEntries,
  parsePackMeta,
  pathExists,
  PROFILE_MANIFEST,
} from "./pack";
import {
  installLegacyJsonProfile,
  installPackFromDirectory,
  installPackFromGitHub,
  resolveGitHubFromRegistryItem,
} from "./install";

const profileModuleDir = import.meta.dir ?? process.cwd();
const localCatalogDir = join(profileModuleDir, "..", "..", "..", "profiles");

const REGISTRY_URL = process.env.ORKESTRATE_REGISTRY_URL || "https://orkestrate.space/api/registry";

export type CatalogProfile = {
  id: string;
  profile: Profile;
  sourcePath: string;
  installed: boolean;
  source: "bundled" | "registry";
  github?: string;
};

export type RegistryItem = {
  id: string;
  slug: string;
  kind: string;
  name: string;
  description: string;
  source_url: string;
  manifest_url: string | null;
  version: string;
  manifest_json: any;
};

async function isProfileInstalled(profileName: string): Promise<boolean> {
  const ws = join(workspaceProfilesDir, profileName);
  const gl = join(globalProfilesDir, profileName);
  if (await pathExists(join(ws, PROFILE_MANIFEST))) return true;
  if (await pathExists(join(gl, PROFILE_MANIFEST))) return true;
  if (await pathExists(join(ws, `${profileName}.json`))) return true;
  if (await pathExists(join(gl, `${profileName}.json`))) return true;
  return false;
}

async function loadCatalogEntry(
  slug: string,
  kind: "pack" | "legacy-json",
  path: string,
  source: "bundled" | "registry"
): Promise<CatalogProfile> {
  let profile: Profile;
  if (kind === "pack") {
    const manifestPath = join(path, PROFILE_MANIFEST);
    profile = parseProfile(await Bun.file(manifestPath).json());
    profile.sourcePath = manifestPath;
    profile.packRoot = path;
  } else {
    profile = parseProfile(await Bun.file(path).json());
    profile.sourcePath = path;
    profile.packRoot = join(path, "..");
  }

  return {
    id: slug,
    profile,
    sourcePath: path,
    installed: await isProfileInstalled(profile.name),
    source,
  };
}

async function loadLocalCatalogProfiles(): Promise<CatalogProfile[]> {
  const entries = await listCatalogEntries(localCatalogDir);
  const results = await Promise.allSettled(
    entries.map((entry) => loadCatalogEntry(entry.slug, entry.kind, entry.path, "bundled"))
  );
  return results
    .filter((r): r is PromiseFulfilledResult<CatalogProfile> => r.status === "fulfilled")
    .map((r) => r.value);
}

export async function fetchRegistry(): Promise<RegistryItem[]> {
  try {
    const response = await fetch(REGISTRY_URL, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch registry: ${response.status} ${response.statusText}`);
    }
    return (await response.json()) as RegistryItem[];
  } catch (error) {
    console.warn(`[registry] could not connect to ${REGISTRY_URL}`, error);
    return [];
  }
}

export async function listCatalogProfiles(): Promise<CatalogProfile[]> {
  const [localProfiles, remoteItems] = await Promise.all([
    loadLocalCatalogProfiles(),
    fetchRegistry(),
  ]);

  const remoteProfilePacks = remoteItems.filter((item) => item.kind === "profile-pack");

  const remoteResults = await Promise.allSettled(
    remoteProfilePacks.map(async (item) => {
      let manifest = item.manifest_json;
      if (!manifest && item.manifest_url) {
        const res = await fetch(item.manifest_url);
        if (!res.ok) throw new Error(`Failed to fetch manifest for ${item.slug}`);
        manifest = await res.json();
      }
      if (!manifest) {
        throw new Error(`Profile pack "${item.slug}" has no manifest`);
      }

      const profile = parseProfile(manifest);
      const meta = parsePackMeta(manifest);
      const gh = parseGitHubFromRegistryItem(item);

      return {
        id: item.slug,
        profile,
        sourcePath: item.source_url,
        installed: await isProfileInstalled(profile.name),
        source: "registry" as const,
        github: `${gh.owner}/${gh.repo}@${gh.ref}${gh.packPath ? `/${gh.packPath}` : ""}`,
      };
    })
  );

  const remoteProfiles: CatalogProfile[] = remoteResults
    .filter((r) => r.status === "fulfilled")
    .map((r) => (r as PromiseFulfilledResult<CatalogProfile>).value);

  const seen = new Set<string>();
  const merged: CatalogProfile[] = [];

  for (const p of [...localProfiles, ...remoteProfiles]) {
    if (!seen.has(p.profile.name)) {
      seen.add(p.profile.name);
      merged.push(p);
    }
  }

  return merged;
}

function parseGitHubFromRegistryItem(item: RegistryItem) {
  return resolveGitHubFromRegistryItem(item);
}

export async function installCatalogProfile(
  slug: string,
  options?: { target?: "workspace" | "global"; overwrite?: boolean }
): Promise<Profile> {
  const safeSlug = slug.replace(/[^a-z0-9-_]/gi, "");

  const localEntries = await listCatalogEntries(localCatalogDir);
  const local = localEntries.find((e) => e.slug === safeSlug || e.slug === slug);
  const target = options?.target ?? "workspace";
  const overwrite = options?.overwrite;

  if (local) {
    if (local.kind === "pack") {
      return installPackFromDirectory(local.path, { target, overwrite });
    }
    return installLegacyJsonProfile(local.path, { target, overwrite });
  }

  const items = await fetchRegistry();
  const item = items.find((i) => i.slug === slug || i.slug === safeSlug);
  if (!item || item.kind !== "profile-pack") {
    throw new Error(`Profile pack "${slug}" not found in catalog or registry.`);
  }

  if (!item.source_url) {
    throw new Error(`Profile pack "${slug}" has no source_url`);
  }

  const gh = resolveGitHubFromRegistryItem(item);
  const meta = parsePackMeta(item.manifest_json ?? {});

  return installPackFromGitHub(item.source_url, {
    ref: meta.ref ?? gh.ref,
    packPath: meta.packPath ?? gh.packPath,
    slug: item.slug,
    target,
    overwrite,
  });
}