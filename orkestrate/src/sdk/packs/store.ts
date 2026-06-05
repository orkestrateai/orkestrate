import { cp, mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parsePackManifest, toPack, type Pack } from "./schema";
import { findPackManifestInDir, listCatalogEntries, pathExists, parseManifestYaml } from "./fs";
import { globalPacksDir, harnessSliceDir, PACK_MANIFEST, workspacePacksDir } from "./paths";

const moduleDir = import.meta.dir ?? process.cwd();
export const bundledCatalogDir = join(moduleDir, "..", "..", "..", "packs");

export type PackLocation = {
  pack: Pack;
  scope: "workspace" | "global" | "bundled";
};

async function loadPackFromDir(dir: string, scope: PackLocation["scope"]): Promise<Pack | null> {
  const manifestPath = await findPackManifestInDir(dir);
  if (!manifestPath) return null;
  const raw = await Bun.file(manifestPath).text();
  const manifest = parsePackManifest(parseManifestYaml(raw));
  return toPack(manifest, dir, manifestPath);
}

async function discoverInstalled(baseDir: string, scope: "workspace" | "global"): Promise<Pack[]> {
  const found: Pack[] = [];
  try {
    const names = await readdir(baseDir);
    for (const name of names) {
      const full = join(baseDir, name);
      const info = await stat(full);
      if (!info.isDirectory()) continue;
      const pack = await loadPackFromDir(full, scope);
      if (pack) found.push(pack);
    }
  } catch {
    return [];
  }
  return found;
}

export async function ensurePackStore(): Promise<void> {
  await mkdir(globalPacksDir, { recursive: true });
  await mkdir(workspacePacksDir, { recursive: true });
}

export async function listInstalledPacks(): Promise<PackLocation[]> {
  await ensurePackStore();
  await seedBundledToGlobalIfMissing();
  const global = (await discoverInstalled(globalPacksDir, "global")).map((pack) => ({
    pack,
    scope: "global" as const,
  }));
  const workspace = (await discoverInstalled(workspacePacksDir, "workspace")).map((pack) => ({
    pack,
    scope: "workspace" as const,
  }));
  const byId = new Map<string, PackLocation>();
  for (const loc of global) byId.set(loc.pack.id, loc);
  for (const loc of workspace) byId.set(loc.pack.id, loc);
  return [...byId.values()].sort((a, b) => a.pack.id.localeCompare(b.pack.id));
}

export async function resolvePack(packId: string): Promise<Pack> {
  const locations = await listInstalledPacks();
  const hit = locations.find((l) => l.pack.id === packId);
  if (hit) return hit.pack;

  const bundled = join(bundledCatalogDir, packId);
  const fromBundled = await loadPackFromDir(bundled, "bundled");
  if (fromBundled) return fromBundled;

  throw new Error(`Pack "${packId}" is not installed. Run: orkestrate pack install ${packId}`);
}

export async function installPackFromDirectory(
  sourceRoot: string,
  options: { target?: "workspace" | "global"; overwrite?: boolean } = {}
): Promise<Pack> {
  const manifestPath = await findPackManifestInDir(sourceRoot);
  if (!manifestPath) {
    throw new Error(`Source does not contain ${PACK_MANIFEST}`);
  }
  const raw = await Bun.file(manifestPath).text();
  const manifest = parsePackManifest(parseManifestYaml(raw));
  const pack = toPack(manifest, sourceRoot, manifestPath);

  const target = options.target ?? "workspace";
  const base = target === "global" ? globalPacksDir : workspacePacksDir;
  const dest = join(base, pack.id);

  if ((await pathExists(dest)) && !options.overwrite) {
    throw new Error(`Pack "${pack.id}" is already installed at ${dest}`);
  }
  if (await pathExists(dest)) {
    await rm(dest, { recursive: true, force: true });
  }
  await mkdir(base, { recursive: true });
  await cp(sourceRoot, dest, { recursive: true, force: true });

  return toPack(manifest, dest, join(dest, PACK_MANIFEST));
}

export async function validatePackLayout(pack: Pack): Promise<{ errors: string[]; warnings: string[] }> {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!(await pathExists(pack.manifestPath))) {
    errors.push(`Missing ${PACK_MANIFEST} at pack root (${pack.packRoot})`);
    return { errors, warnings };
  }

  const infoPath = join(pack.packRoot, "info.md");
  if (!(await pathExists(infoPath))) {
    warnings.push("Missing info.md (recommended pack readme for authors and agents)");
  }

  const slice = harnessSliceDir(pack.packRoot, pack.harness);
  if (!(await pathExists(slice))) {
    errors.push(
      `Missing harness slice directory: ${join("harnesses", pack.harness)}/\n` +
        `  → Add native harness config under harnesses/${pack.harness}/ (see packs/coding).`
    );
    return { errors, warnings };
  }

  const configPath = join(slice, "opencode.json");
  if (!(await pathExists(configPath))) {
    errors.push(
      `Missing ${join("harnesses", pack.harness, "opencode.json")}\n` +
        `  → Copy from packs/coding or run: orkestrate pack create <id> --from coding`
    );
  } else {
    try {
      const config = await Bun.file(configPath).json();
      const agent = config.default_agent;
      if (typeof agent !== "string" || !agent) {
        warnings.push('opencode.json has no "default_agent" — launch will use pack id');
      } else {
        const agentFile = join(slice, "agents", `${agent}.md`);
        if (!(await pathExists(agentFile))) {
          errors.push(
            `opencode.json default_agent "${agent}" has no agents/${agent}.md\n` +
              `  → Create harnesses/${pack.harness}/agents/${agent}.md`
          );
        }
      }
    } catch {
      errors.push(`Invalid JSON: ${configPath}`);
    }
  }

  const agentsDir = join(slice, "agents");
  if (await pathExists(agentsDir)) {
    const agents = (await readdir(agentsDir)).filter((f) => f.endsWith(".md"));
    if (agents.length === 0) {
      warnings.push(`No agent prompts in harnesses/${pack.harness}/agents/*.md`);
    }
  } else if (pack.harness === "opencode") {
    warnings.push(`Missing harnesses/opencode/agents/ (primary agent markdown prompts)`);
  }

  return { errors, warnings };
}

export async function seedBundledToGlobalIfMissing(): Promise<void> {
  const entries = await listCatalogEntries(bundledCatalogDir);
  for (const entry of entries) {
    if (entry.kind !== "pack") continue;
    const dest = join(globalPacksDir, entry.slug);
    if (await pathExists(dest)) continue;
    await installPackFromDirectory(entry.path, { target: "global", overwrite: false });
  }
}