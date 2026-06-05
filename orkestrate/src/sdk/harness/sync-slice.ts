import { cp, mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import { pathExists } from "../packs/fs";

/**
 * Seed OpenCode config from a pack harness slice without clobbering user edits.
 * - First launch: copy full slice.
 * - Later launches: add missing agents/skills/plugins only; never overwrite opencode.json.
 */
export async function seedHarnessSlice(sliceDir: string, destDir: string): Promise<void> {
  await mkdir(destDir, { recursive: true });

  const destConfig = join(destDir, "opencode.json");
  const isFirstSeed = !(await pathExists(destConfig));

  if (isFirstSeed) {
    await cp(sliceDir, destDir, { recursive: true, force: true });
    return;
  }

  await mergeMissingSubtree(join(sliceDir, "agents"), join(destDir, "agents"));
  await mergeMissingSubtree(join(sliceDir, "skills"), join(destDir, "skills"));
  await mergeMissingSubtree(join(sliceDir, "plugins"), join(destDir, "plugins"));

  for (const file of ["AGENTS.md", "README.md"]) {
    const src = join(sliceDir, file);
    const dst = join(destDir, file);
    if ((await pathExists(src)) && !(await pathExists(dst))) {
      await cp(src, dst, { force: true });
    }
  }
}

async function mergeMissingSubtree(srcDir: string, destDir: string): Promise<void> {
  if (!(await pathExists(srcDir))) return;
  await mkdir(destDir, { recursive: true });
  await copyMissingRecursive(srcDir, destDir);
}

async function copyMissingRecursive(src: string, dest: string): Promise<void> {
  const entries = await readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    if (entry.isDirectory()) {
      if (!(await pathExists(destPath))) {
        await mkdir(destPath, { recursive: true });
      }
      await copyMissingRecursive(srcPath, destPath);
      continue;
    }
    if (!(await pathExists(destPath))) {
      await mkdir(join(destPath, ".."), { recursive: true });
      await cp(srcPath, destPath, { force: true });
    }
  }
}