import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { registry } from "../registry";
import type { ExtensionContext, OrkExtension } from "./types";

const context: ExtensionContext = {
  registerAdapter(harness, adapter) {
    registry.registerAdapter(harness, adapter);
  },
};

async function getSubdirectories(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir);
    const subdirs: string[] = [];
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const s = await stat(fullPath);
      if (s.isDirectory()) {
        subdirs.push(fullPath);
      }
    }
    return subdirs;
  } catch {
    return [];
  }
}

export async function loadExtensions(): Promise<void> {
  const baseDir = import.meta.dir ?? process.cwd();
  const bundledDir = join(baseDir, "..", "..", "..", "extensions");
  const globalDir = join(homedir(), ".orkestrate", "extensions");
  const workspaceDir = join(process.cwd(), ".orkestrate", "extensions");

  const pathsToScan = [bundledDir, globalDir, workspaceDir];
  const extensionDirs: string[] = [];

  for (const dir of pathsToScan) {
    const subdirs = await getSubdirectories(dir);
    for (const subdir of subdirs) {
      if (!extensionDirs.includes(subdir)) {
        extensionDirs.push(subdir);
      }
    }
  }

  for (const dir of extensionDirs) {
    try {
      // Only attempt to load if it has an entry point or package.json
      const hasEntryPoint = 
        await Bun.file(join(dir, "index.ts")).exists() ||
        await Bun.file(join(dir, "index.js")).exists() ||
        await Bun.file(join(dir, "package.json")).exists();

      if (!hasEntryPoint) {
        continue;
      }

      // Bun/Node import supports importing directory directly (using index.ts / index.js / package.json)
      const mod = await import(dir);
      
      // Look for standard exports: default or named
      const raw = mod.default || mod.extension || mod;

      if (typeof raw !== "object" || raw === null) {
        console.warn(`Extension at "${dir}" does not export a valid object — skipping`);
        continue;
      }

      // Validate OrkExtension shape before activating
      const missing: string[] = [];
      if (typeof raw.id !== "string" || !raw.id) missing.push("id");
      if (typeof raw.name !== "string" || !raw.name) missing.push("name");
      if (typeof raw.version !== "string" || !raw.version) missing.push("version");
      if (typeof raw.activate !== "function") missing.push("activate");
      if (missing.length > 0) {
        console.warn(`Extension at "${dir}" is missing required field(s): ${missing.join(", ")} — skipping`);
        continue;
      }

      const ext = raw as OrkExtension;
      await ext.activate(context);
    } catch (error) {
      // Don't let one failing extension crash the entire loader
      console.warn(`Failed to load extension at "${dir}":`, error);
    }
  }
}
