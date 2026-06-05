import { cp, mkdir, readdir, stat } from "node:fs/promises";
import { join, basename } from "node:path";
import type { Profile } from "./schema";
import { pathExists } from "./pack";

const profileModuleDir = import.meta.dir ?? process.cwd();
const bundledSkillsDir = join(profileModuleDir, "..", "..", "..", "skills");

async function copySkillDir(skillDir: string, targetSkillsRoot: string, skillName: string): Promise<void> {
  const dest = join(targetSkillsRoot, skillName);
  await mkdir(dest, { recursive: true });
  await cp(skillDir, dest, { recursive: true, force: true });
}

async function resolveSkillSource(skillId: string, packRoot: string, cwd: string): Promise<string | null> {
  const packSkill = join(packRoot, "skills", skillId);
  if (await pathExists(join(packSkill, "SKILL.md"))) {
    return packSkill;
  }

  const bundled = join(bundledSkillsDir, skillId);
  if (await pathExists(join(bundled, "SKILL.md"))) {
    return bundled;
  }

  const candidates = [
    join(cwd, ".opencode", "skills", skillId),
    join(cwd, ".agents", "skills", skillId),
    join(cwd, ".claude", "skills", skillId),
  ];

  for (const candidate of candidates) {
    if (await pathExists(join(candidate, "SKILL.md"))) {
      return candidate;
    }
  }

  return null;
}

export async function materializePackToOpenCodeHome(
  profile: Profile,
  opencodeConfigDir: string,
  cwd: string
): Promise<{ skillNames: string[]; pluginPaths: string[] }> {
  const packRoot = profile.packRoot ?? join(profile.sourcePath ?? cwd, "..");
  const skillsOut = join(opencodeConfigDir, "skills");
  const pluginsOut = join(opencodeConfigDir, "plugins");
  await mkdir(skillsOut, { recursive: true });
  await mkdir(pluginsOut, { recursive: true });

  const resources = profile.config?.resources || profile.resources;
  const requestedSkills = new Set<string>([...(resources?.skills ?? []), "orkestrate"]);
  const installedSkills: string[] = [];

  for (const skillId of requestedSkills) {
    const source = await resolveSkillSource(skillId, packRoot, cwd);
    if (!source) continue;
    await copySkillDir(source, skillsOut, basename(source) === skillId ? skillId : basename(source));
    installedSkills.push(skillId);
  }

  const pluginsDir = join(packRoot, "plugins");
  const pluginPaths: string[] = [];
  if (await pathExists(pluginsDir)) {
    const entries = await readdir(pluginsDir);
    for (const entry of entries) {
      if (!/\.(ts|js|mjs|cjs)$/.test(entry)) continue;
      const src = join(pluginsDir, entry);
      const dest = join(pluginsOut, entry);
      await cp(src, dest, { force: true });
      pluginPaths.push(dest);
    }
  }

  return { skillNames: installedSkills, pluginPaths };
}

export function buildSkillAllowPermission(skillNames: string[]): Record<string, "allow"> {
  const permission: Record<string, "allow"> = {};
  for (const name of skillNames) {
    permission[name] = "allow";
  }
  return permission;
}