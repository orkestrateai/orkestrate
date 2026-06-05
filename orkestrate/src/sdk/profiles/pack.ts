import { cp, mkdir, readdir, stat } from "node:fs/promises";
import { join, basename } from "node:path";

export const PROFILE_MANIFEST = "profile.json";

export type PackMeta = {
  slug?: string;
  ref?: string;
  packPath?: string;
  sourceUrl?: string;
};

export function getPackRootFromProfilePath(profileJsonPath: string): string {
  return join(profileJsonPath, "..");
}

export async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

export async function copyDirectory(src: string, dest: string): Promise<void> {
  await mkdir(dest, { recursive: true });
  await cp(src, dest, { recursive: true, force: true });
}

export async function findProfileManifestInDir(dir: string): Promise<string | null> {
  const direct = join(dir, PROFILE_MANIFEST);
  if (await pathExists(direct)) return direct;
  return null;
}

/** List installable catalog slugs: `name/` packs and legacy `name.json` files. */
export async function listCatalogEntries(catalogDir: string): Promise<
  { slug: string; kind: "pack" | "legacy-json"; path: string }[]
> {
  const entries: { slug: string; kind: "pack" | "legacy-json"; path: string }[] = [];
  try {
    const names = await readdir(catalogDir);
    for (const name of names) {
      const full = join(catalogDir, name);
      const info = await stat(full);
      if (info.isDirectory()) {
        if (await findProfileManifestInDir(full)) {
          entries.push({ slug: name, kind: "pack", path: full });
        }
      } else if (name.endsWith(".json")) {
        entries.push({ slug: name.slice(0, -".json".length), kind: "legacy-json", path: full });
      }
    }
  } catch {
    return [];
  }
  return entries.sort((a, b) => a.slug.localeCompare(b.slug));
}

export function parsePackMeta(manifest: Record<string, unknown>): PackMeta {
  const block = manifest.orkestrate;
  if (!block || typeof block !== "object" || Array.isArray(block)) {
    return {};
  }
  const o = block as Record<string, unknown>;
  return {
    slug: typeof o.slug === "string" ? o.slug : undefined,
    ref: typeof o.ref === "string" ? o.ref : undefined,
    packPath: typeof o.packPath === "string" ? o.packPath : undefined,
    sourceUrl: typeof o.sourceUrl === "string" ? o.sourceUrl : undefined,
  };
}

export async function validatePackBundle(
  profile: { packRoot?: string; sourcePath?: string; config?: Record<string, any>; resources?: { skills?: string[] } },
  options?: { bundledSkillsDir?: string; cwd?: string }
): Promise<{ errors: string[]; warnings: string[] }> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const packRoot = profile.packRoot ?? join(profile.sourcePath ?? ".", "..");
  const cwd = options?.cwd ?? process.cwd();
  const resources = profile.config?.resources ?? profile.resources;
  const skills = resources?.skills ?? [];

  for (const skillId of skills) {
    const packSkill = join(packRoot, "skills", skillId, "SKILL.md");
    if (await pathExists(packSkill)) continue;

    if (options?.bundledSkillsDir) {
      const bundled = join(options.bundledSkillsDir, skillId, "SKILL.md");
      if (await pathExists(bundled)) continue;
    }

    const workspaceCandidates = [
      join(cwd, ".opencode", "skills", skillId, "SKILL.md"),
      join(cwd, ".agents", "skills", skillId, "SKILL.md"),
    ];
    const found = await Promise.all(workspaceCandidates.map(pathExists));
    if (found.some(Boolean)) continue;

    errors.push(`Skill "${skillId}" not found in pack, bundled skills, or workspace`);
  }

  const pluginsDir = join(packRoot, "plugins");
  if (await pathExists(pluginsDir)) {
    const entries = await readdir(pluginsDir);
    const pluginFiles = entries.filter((e) => /\.(ts|js|mjs|cjs)$/.test(e));
    if (entries.length > 0 && pluginFiles.length === 0) {
      warnings.push("plugins/ exists but contains no .ts/.js plugin files");
    }
  }

  return { errors, warnings };
}

export async function applyScaffold(
  packRoot: string,
  workspaceCwd: string,
  profileName: string
): Promise<void> {
  const scaffoldDir = join(packRoot, "scaffold");
  if (!(await pathExists(scaffoldDir))) return;

  const target = join(workspaceCwd, ".orkestrate", "packs", profileName);
  await mkdir(target, { recursive: true });
  await copyDirectory(scaffoldDir, target);
}