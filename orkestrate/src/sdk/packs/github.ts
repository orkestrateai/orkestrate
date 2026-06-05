import { cp, mkdir, readdir, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { homedir } from "node:os";
import { findPackManifestInDir, pathExists } from "./fs";
import { PACK_MANIFEST } from "./paths";
import type { Pack } from "./schema";

export type GitHubSource = {
  owner: string;
  repo: string;
  ref: string;
  packPath: string;
  webUrl: string;
};

export function packsCacheDir(): string {
  return join(homedir(), ".orkestrate", "registry-cache");
}

export function parseGitHubSource(
  sourceUrl: string,
  options?: { ref?: string; packPath?: string }
): GitHubSource {
  let url: URL;
  try {
    url = new URL(sourceUrl);
  } catch {
    throw new Error(`Invalid source URL: ${sourceUrl}`);
  }

  if (url.hostname !== "github.com") {
    throw new Error("Only github.com source URLs are supported");
  }

  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length < 2) {
    throw new Error(`Invalid GitHub URL: ${sourceUrl}`);
  }

  const owner = parts[0]!;
  const repo = parts[1]!.replace(/\.git$/, "");

  let ref = options?.ref ?? "main";
  let packPath = options?.packPath ?? "";

  if (parts[2] === "tree" || parts[2] === "blob") {
    ref = parts[3] ?? ref;
    packPath = parts.slice(4).join("/");
  }

  if (options?.packPath) {
    packPath = options.packPath;
  }

  return {
    owner,
    repo,
    ref,
    packPath: packPath.replace(/^\/+|\/+$/g, ""),
    webUrl: `https://github.com/${owner}/${repo}`,
  };
}

export function parseRegistryMeta(manifest: unknown): { ref?: string; packPath?: string } {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    return {};
  }
  const block = (manifest as Record<string, unknown>).orkestrate;
  if (!block || typeof block !== "object" || Array.isArray(block)) {
    return {};
  }
  const o = block as Record<string, unknown>;
  return {
    ref: typeof o.ref === "string" ? o.ref : undefined,
    packPath: typeof o.packPath === "string" ? o.packPath : undefined,
  };
}

export function resolveGitHubFromRegistryItem(item: {
  source_url: string;
  version?: string;
  manifest_json?: unknown;
  slug: string;
}): GitHubSource {
  const meta = parseRegistryMeta(item.manifest_json);
  const ref = meta.ref ?? item.version ?? "main";
  return parseGitHubSource(item.source_url, { ref, packPath: meta.packPath });
}

async function findPackRoot(cloneRoot: string, packPath: string): Promise<string> {
  const trimmed = packPath.replace(/^\/+|\/+$/g, "");
  if (trimmed) {
    const candidate = join(cloneRoot, trimmed);
    if (await findPackManifestInDir(candidate)) {
      return candidate;
    }
    throw new Error(`Pack path "${packPath}" does not contain ${PACK_MANIFEST}`);
  }

  if (await findPackManifestInDir(cloneRoot)) {
    return cloneRoot;
  }

  const entries = await readdir(cloneRoot);
  for (const entry of entries) {
    const full = join(cloneRoot, entry);
    const info = await stat(full);
    if (info.isDirectory() && (await findPackManifestInDir(full))) {
      return full;
    }
  }

  throw new Error(`Repository does not contain a pack (${PACK_MANIFEST} not found)`);
}

async function commandExists(command: string): Promise<boolean> {
  const proc = Bun.spawnSync({
    cmd: [command, "--version"],
    stdout: "ignore",
    stderr: "ignore",
  });
  return proc.exitCode === 0;
}

async function cloneWithGit(source: GitHubSource, dest: string): Promise<string> {
  const cloneUrl = `${source.webUrl}.git`;
  const proc = Bun.spawn(
    ["git", "clone", "--depth", "1", "--branch", source.ref, "--single-branch", cloneUrl, dest],
    { stdout: "pipe", stderr: "pipe" }
  );
  const code = await proc.exited;
  if (code !== 0) {
    const err = await new Response(proc.stderr).text();
    throw new Error(`git clone failed: ${err.trim() || `exit ${code}`}`);
  }
  return findPackRoot(dest, source.packPath);
}

async function downloadTarball(source: GitHubSource, dest: string): Promise<string> {
  const apiUrl = `https://api.github.com/repos/${source.owner}/${source.repo}/tarball/${source.ref}`;
  const response = await fetch(apiUrl, {
    headers: { Accept: "application/vnd.github+json", "User-Agent": "orkestrate-cli" },
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(`GitHub archive download failed: ${response.status} ${response.statusText}`);
  }

  const archivePath = join(dest, "archive.tar.gz");
  await mkdir(dest, { recursive: true });
  await Bun.write(archivePath, await response.arrayBuffer());

  const extractDir = join(dest, "extract");
  await mkdir(extractDir, { recursive: true });

  const tar = Bun.spawn(["tar", "-xzf", archivePath, "-C", extractDir], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const tarCode = await tar.exited;
  if (tarCode !== 0) {
    const err = await new Response(tar.stderr).text();
    throw new Error(`tar extract failed: ${err.trim() || "install git or tar"}`);
  }

  const top = await readdir(extractDir);
  if (top.length === 0) {
    throw new Error("GitHub archive was empty");
  }
  const root = join(extractDir, top[0]!);
  return findPackRoot(root, source.packPath);
}

export async function fetchGitHubPackRoot(source: GitHubSource): Promise<string> {
  const work = join(tmpdir(), `orkestrate-fetch-${source.owner}-${source.repo}-${Date.now()}`);
  await mkdir(work, { recursive: true });

  try {
    if (await commandExists("git")) {
      try {
        return await cloneWithGit(source, join(work, "repo"));
      } catch {
        // fall through to tarball
      }
    }
    return await downloadTarball(source, work);
  } catch (error) {
    await rm(work, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
}

export async function installPackFromGitHub(
  sourceUrl: string,
  options: {
    ref?: string;
    packPath?: string;
    slug?: string;
    target?: "workspace" | "global";
    overwrite?: boolean;
  } = {}
): Promise<Pack> {
  const { installPackFromDirectory } = await import("./store");
  const source = parseGitHubSource(sourceUrl, {
    ref: options.ref,
    packPath: options.packPath,
  });

  const cacheSlug = (options.slug ?? `${source.owner}-${source.repo}-${source.ref}`).replace(
    /[^a-z0-9-_]+/gi,
    "-"
  );
  const cacheDir = join(packsCacheDir(), cacheSlug);

  if (await pathExists(cacheDir)) {
    await rm(cacheDir, { recursive: true, force: true });
  }
  await mkdir(packsCacheDir(), { recursive: true });

  const packRoot = await fetchGitHubPackRoot(source);
  const parent = join(packRoot, "..");
  await cp(packRoot, cacheDir, { recursive: true, force: true });
  await rm(parent, { recursive: true, force: true }).catch(() => {});

  const installed = await installPackFromDirectory(cacheDir, {
    target: options.target ?? "workspace",
    overwrite: options.overwrite ?? false,
  });

  await writeInstallRecord(installed.packRoot, {
    source: "registry",
    sourceUrl,
    ref: source.ref,
    packPath: source.packPath,
    slug: cacheSlug,
    installedAt: new Date().toISOString(),
  });

  return installed;
}

async function writeInstallRecord(packDir: string, record: Record<string, unknown>): Promise<void> {
  await Bun.write(
    join(packDir, ".orkestrate-install.json"),
    JSON.stringify(record, null, 2) + "\n"
  );
}