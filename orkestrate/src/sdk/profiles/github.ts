import { mkdir, readdir, stat, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { copyDirectory, findProfileManifestInDir, pathExists } from "./pack";

export type GitHubSource = {
  owner: string;
  repo: string;
  ref: string;
  packPath: string;
  webUrl: string;
};

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
    throw new Error("Only github.com source URLs are supported in v1");
  }

  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length < 2) {
    throw new Error(`Invalid GitHub URL: ${sourceUrl}`);
  }

  const owner = parts[0];
  const repo = parts[1].replace(/\.git$/, "");

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

async function findPackRoot(cloneRoot: string, packPath: string): Promise<string> {
  const trimmed = packPath.replace(/^\/+|\/+$/g, "");
  if (trimmed) {
    const candidate = join(cloneRoot, trimmed);
    if (await findProfileManifestInDir(candidate)) {
      return candidate;
    }
    throw new Error(`Pack path "${packPath}" does not contain ${PROFILE_MANIFEST}`);
  }

  if (await findProfileManifestInDir(cloneRoot)) {
    return cloneRoot;
  }

  const entries = await readdir(cloneRoot);
  for (const entry of entries) {
    const full = join(cloneRoot, entry);
    const info = await stat(full);
    if (info.isDirectory() && (await findProfileManifestInDir(full))) {
      return full;
    }
  }

  throw new Error("Repository does not contain a profile pack (profile.json not found)");
}

const PROFILE_MANIFEST = "profile.json";

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
  return await findPackRoot(dest, source.packPath);
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
  const root = join(extractDir, top[0]);
  return await findPackRoot(root, source.packPath);
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

export async function installGitHubPackToDirectory(
  source: GitHubSource,
  targetDir: string
): Promise<string> {
  const packRoot = await fetchGitHubPackRoot(source);
  const parent = join(packRoot, "..");
  await copyDirectory(packRoot, targetDir);
  await rm(parent, { recursive: true, force: true }).catch(() => {});
  const manifest = join(targetDir, PROFILE_MANIFEST);
  if (!(await pathExists(manifest))) {
    throw new Error("Installed pack is missing profile.json");
  }
  return manifest;
}

async function commandExists(command: string): Promise<boolean> {
  const proc = Bun.spawnSync({
    cmd: [command, "--version"],
    stdout: "ignore",
    stderr: "ignore",
  });
  return proc.exitCode === 0;
}