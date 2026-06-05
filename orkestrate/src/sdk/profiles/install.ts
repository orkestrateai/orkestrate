import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { parseProfile, type Profile } from "./schema";
import { assertProfileName, globalProfilesDir, workspaceProfilesDir } from "./load";
import {
  PROFILE_MANIFEST,
  applyScaffold,
  copyDirectory,
  findProfileManifestInDir,
  getPackRootFromProfilePath,
  pathExists,
} from "./pack";
import { installGitHubPackToDirectory, parseGitHubSource, type GitHubSource } from "./github";

export type InstallTarget = "workspace" | "global";

export function packsCacheDir(): string {
  return join(homedir(), ".orkestrate", "packs");
}

export function installedProfileDir(name: string, target: InstallTarget): string {
  const base = target === "global" ? globalProfilesDir : workspaceProfilesDir;
  return join(base, assertProfileName(name));
}

export async function writeInstallRecord(
  profileDir: string,
  record: Record<string, unknown>
): Promise<void> {
  await writeFile(join(profileDir, ".orkestrate-install.json"), JSON.stringify(record, null, 2) + "\n");
}

export async function installPackFromDirectory(
  sourcePackRoot: string,
  options: {
    target?: InstallTarget;
    overwrite?: boolean;
    applyWorkspaceScaffold?: boolean;
    installRecord?: Record<string, unknown>;
  } = {}
): Promise<Profile> {
  const manifestPath = await findProfileManifestInDir(sourcePackRoot);
  if (!manifestPath) {
    throw new Error(`Source pack does not contain ${PROFILE_MANIFEST}`);
  }

  const raw = await Bun.file(manifestPath).json();
  const profile = parseProfile(raw);
  profile.sourcePath = manifestPath;
  profile.packRoot = getPackRootFromProfilePath(manifestPath);

  const target = options.target ?? "workspace";
  const destDir = installedProfileDir(profile.name, target);

  if ((await pathExists(destDir)) && !options.overwrite) {
    throw new Error(`Profile "${profile.name}" is already installed at ${destDir}`);
  }

  if (await pathExists(destDir)) {
    await rm(destDir, { recursive: true, force: true });
  }

  await mkdir(join(target === "global" ? globalProfilesDir : workspaceProfilesDir), {
    recursive: true,
  });
  await copyDirectory(sourcePackRoot, destDir);

  const installedManifest = join(destDir, PROFILE_MANIFEST);
  profile.sourcePath = installedManifest;
  profile.packRoot = destDir;

  if (options.installRecord) {
    await writeInstallRecord(destDir, options.installRecord);
  }

  if (options.applyWorkspaceScaffold !== false) {
    await applyScaffold(destDir, process.cwd(), profile.name);
  }

  return profile;
}

export async function installPackFromGitHub(
  sourceUrl: string,
  options: {
    ref?: string;
    packPath?: string;
    slug?: string;
    target?: InstallTarget;
    overwrite?: boolean;
  } = {}
): Promise<Profile> {
  const source = parseGitHubSource(sourceUrl, {
    ref: options.ref,
    packPath: options.packPath,
  });

  const cacheSlug = options.slug ?? `${source.owner}-${source.repo}-${source.ref}`.replace(/[^a-z0-9-_]+/gi, "-");
  const cacheDir = join(packsCacheDir(), cacheSlug);

  if (await pathExists(cacheDir)) {
    await rm(cacheDir, { recursive: true, force: true });
  }
  await mkdir(packsCacheDir(), { recursive: true });

  await installGitHubPackToDirectory(source, cacheDir);

  return installPackFromDirectory(cacheDir, {
    target: options.target ?? "workspace",
    overwrite: options.overwrite,
    installRecord: {
      source: "github",
      sourceUrl,
      ref: source.ref,
      packPath: source.packPath,
      slug: cacheSlug,
      installedAt: new Date().toISOString(),
    },
  });
}

export async function installLegacyJsonProfile(
  jsonPath: string,
  options: { target?: InstallTarget; overwrite?: boolean } = {}
): Promise<Profile> {
  const raw = await Bun.file(jsonPath).json();
  const profile = parseProfile(raw);
  const target = options.target ?? "workspace";
  const destDir = installedProfileDir(profile.name, target);

  if ((await pathExists(destDir)) && !options.overwrite) {
    throw new Error(`Profile "${profile.name}" is already installed`);
  }

  if (await pathExists(destDir)) {
    await rm(destDir, { recursive: true, force: true });
  }

  await mkdir(destDir, { recursive: true });
  const onlyManifest = join(destDir, PROFILE_MANIFEST);
  await writeFile(onlyManifest, JSON.stringify(raw, null, 2) + "\n");

  profile.sourcePath = onlyManifest;
  profile.packRoot = destDir;
  return profile;
}

export function resolveGitHubFromRegistryItem(item: {
  source_url: string;
  version?: string;
  manifest_json?: any;
  slug: string;
}): GitHubSource & { slug: string } {
  const manifest = item.manifest_json ?? {};
  const meta = manifest.orkestrate ?? {};
  const ref = typeof meta.ref === "string" ? meta.ref : item.version ?? "main";
  const packPath = typeof meta.packPath === "string" ? meta.packPath : "";
  const source = parseGitHubSource(item.source_url, { ref, packPath });
  return { ...source, slug: item.slug };
}