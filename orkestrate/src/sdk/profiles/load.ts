import { copyFile, mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseProfile, type Profile } from "./schema";
import { homedir } from "node:os";
import {
  PROFILE_MANIFEST,
  findProfileManifestInDir,
  getPackRootFromProfilePath,
  listCatalogEntries,
  pathExists,
} from "./pack";

const profileModuleDir = import.meta.dir ?? process.cwd();
const seedProfilesDir = join(profileModuleDir, "..", "..", "..", "profiles");
export const workspaceProfilesDir = join(process.cwd(), ".orkestrate", "profiles");
export const globalProfilesDir = join(homedir(), ".orkestrate", "profiles");

export type ProfileLocation = {
  name: string;
  manifestPath: string;
  packRoot: string;
  scope: "workspace" | "global";
};

async function discoverInStore(baseDir: string, scope: "workspace" | "global"): Promise<ProfileLocation[]> {
  const found: ProfileLocation[] = [];
  try {
    const entries = await readdir(baseDir);
    for (const entry of entries) {
      const full = join(baseDir, entry);
      const info = await stat(full);

      if (info.isDirectory()) {
        const manifest = await findProfileManifestInDir(full);
        if (manifest) {
          found.push({
            name: entry,
            manifestPath: manifest,
            packRoot: full,
            scope,
          });
        }
        continue;
      }

      if (entry.endsWith(".json")) {
        const name = entry.slice(0, -".json".length);
        found.push({
          name,
          manifestPath: full,
          packRoot: getPackRootFromProfilePath(full),
          scope,
        });
      }
    }
  } catch {
    return [];
  }
  return preferPackDirsOverLegacyJson(found);
}

/** When both `name/` and `name.json` exist, keep the directory pack. */
function preferPackDirsOverLegacyJson(locations: ProfileLocation[]): ProfileLocation[] {
  const byName = new Map<string, ProfileLocation>();
  for (const loc of locations) {
    const existing = byName.get(loc.name);
    if (!existing) {
      byName.set(loc.name, loc);
      continue;
    }
    const existingIsDir = existing.manifestPath.endsWith(`${PROFILE_MANIFEST}`);
    const nextIsDir = loc.manifestPath.endsWith(`${PROFILE_MANIFEST}`);
    if (!existingIsDir && nextIsDir) {
      byName.set(loc.name, loc);
    }
  }
  return [...byName.values()];
}

export function assertProfileName(name: string): string {
  if (!/^[a-z0-9][a-z0-9-_]*$/.test(name)) {
    throw new Error('Profile name must use lowercase letters, numbers, "-", or "_"');
  }
  return name;
}

export async function ensureProfileStore(): Promise<void> {
  await mkdir(globalProfilesDir, { recursive: true });
  await mkdir(workspaceProfilesDir, { recursive: true });

  const catalogEntries = await listCatalogEntries(seedProfilesDir);
  for (const entry of catalogEntries) {
    const installedDir = join(globalProfilesDir, entry.slug);
    if (await pathExists(installedDir)) continue;

    if (entry.kind === "pack") {
      const { copyDirectory } = await import("./pack");
      await copyDirectory(entry.path, installedDir);
    } else {
      await mkdir(installedDir, { recursive: true });
      const raw = await Bun.file(entry.path).json();
      await writeFile(join(installedDir, PROFILE_MANIFEST), JSON.stringify(raw, null, 2) + "\n");
    }
  }
}

export async function resolveProfileLocations(name: string): Promise<ProfileLocation[]> {
  await ensureProfileStore();
  const safe = assertProfileName(name);
  const workspace = await discoverInStore(workspaceProfilesDir, "workspace");
  const global = await discoverInStore(globalProfilesDir, "global");
  return [...workspace, ...global].filter((loc) => {
    const manifestName = loc.name;
    try {
      return manifestName === safe;
    } catch {
      return false;
    }
  });
}

export async function resolveProfileFilePath(name: string): Promise<string> {
  const locations = await resolveProfileLocations(name);
  if (locations.length === 0) {
    await mkdir(workspaceProfilesDir, { recursive: true });
    return join(workspaceProfilesDir, assertProfileName(name), PROFILE_MANIFEST);
  }
  const workspace = locations.find((l) => l.scope === "workspace");
  return (workspace ?? locations[0]).manifestPath;
}

export async function loadProfile(name: string): Promise<Profile> {
  const manifestPath = await resolveProfileFilePath(name);
  if (!(await pathExists(manifestPath))) {
    throw new Error(`Profile "${name}" was not found locally or globally.`);
  }

  const profile = parseProfile(await Bun.file(manifestPath).json(), (warning) => {
    console.warn(`profile "${name}": ${warning.field} - ${warning.message}`);
  });
  profile.sourcePath = manifestPath;
  profile.packRoot = getPackRootFromProfilePath(manifestPath);
  return profile;
}

export async function listProfiles(options?: { warn?: boolean }): Promise<Profile[]> {
  await ensureProfileStore();

  const workspace = await discoverInStore(workspaceProfilesDir, "workspace");
  const global = await discoverInStore(globalProfilesDir, "global");

  const byName = new Map<string, ProfileLocation>();
  for (const loc of preferPackDirsOverLegacyJson([...global, ...workspace])) {
    const existing = byName.get(loc.name);
    if (!existing) {
      byName.set(loc.name, loc);
      continue;
    }
    // Workspace wins over global when both are packs
    if (loc.scope === "workspace") {
      byName.set(loc.name, loc);
    }
  }

  const validProfiles: Profile[] = [];
  for (const loc of byName.values()) {
    try {
      const profile = parseProfile(await Bun.file(loc.manifestPath).json());
      profile.sourcePath = loc.manifestPath;
      profile.packRoot = loc.packRoot;
      validProfiles.push(profile);
    } catch (error) {
      if (options?.warn) {
        console.warn(`Skipped corrupted profile "${loc.name}":`, error);
      }
    }
  }

  return validProfiles.sort((a, b) => a.name.localeCompare(b.name));
}

export async function saveProfile(
  profile: Profile,
  options?: { overwrite?: boolean; isGlobal?: boolean }
): Promise<void> {
  await ensureProfileStore();
  assertProfileName(profile.name);

  const base = options?.isGlobal ? globalProfilesDir : workspaceProfilesDir;
  const dir = join(base, profile.name);
  const manifestPath = join(dir, PROFILE_MANIFEST);

  await mkdir(base, { recursive: true });

  if (!options?.overwrite && (await pathExists(manifestPath))) {
    throw new Error(`Profile "${profile.name}" already exists`);
  }

  await mkdir(dir, { recursive: true });
  await writeFile(manifestPath, JSON.stringify(profile, null, 2) + "\n", "utf-8");
  profile.sourcePath = manifestPath;
  profile.packRoot = dir;
}

/** @deprecated use seed dir layout; kept for re-exports */
export async function jsonProfileNames(dir: string): Promise<string[]> {
  const locs = await discoverInStore(dir, "global");
  return locs.map((l) => l.name);
}