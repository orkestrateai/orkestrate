import { cp, mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { assertPackId, type PackManifest } from "./schema";
import { bundledCatalogDir } from "./store";
import { pathExists } from "./fs";
import { globalPacksDir, workspacePacksDir } from "./paths";

export type CreatePackOptions = {
  id: string;
  description?: string;
  template?: string;
  target?: "workspace" | "global";
};

function yamlEscape(value: string): string {
  if (/[:#\n]/.test(value) || value.startsWith(" ")) {
    return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  }
  return value;
}

function manifestYaml(manifest: PackManifest): string {
  const lines = [
    `id: ${manifest.id}`,
    `name: ${manifest.name}`,
    `description: ${yamlEscape(manifest.description)}`,
    `version: "${manifest.version ?? "0.1.0"}"`,
    `harness: ${manifest.harness}`,
  ];
  return lines.join("\n") + "\n";
}

async function replaceInTree(root: string, from: string, to: string): Promise<void> {
  const entries = await readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(root, entry.name);
    if (entry.isDirectory()) {
      await replaceInTree(full, from, to);
      continue;
    }
    const text = await readFile(full, "utf-8");
    if (!text.includes(from)) continue;
    await writeFile(full, text.split(from).join(to), "utf-8");
  }
}

export async function createPackFromTemplate(options: CreatePackOptions): Promise<string> {
  const id = assertPackId(options.id);
  const template = assertPackId(options.template ?? "coding");
  const templateRoot = join(bundledCatalogDir, template);
  if (!(await pathExists(templateRoot))) {
    throw new Error(`Template pack "${template}" not found in ${bundledCatalogDir}`);
  }

  const target = options.target ?? "workspace";
  const destBase = target === "global" ? globalPacksDir : workspacePacksDir;
  const dest = join(destBase, id);

  if (await pathExists(dest)) {
    throw new Error(`Pack "${id}" already exists at ${dest}`);
  }

  await mkdir(destBase, { recursive: true });
  await cp(templateRoot, dest, { recursive: true });

  const description =
    options.description ??
    (template === id ? `Pack ${id}` : `${template} pack customized as ${id}`);

  const manifest: PackManifest = {
    id,
    name: id,
    description,
    version: "0.1.0",
    harness: "opencode",
  };
  await writeFile(join(dest, "pack.yaml"), manifestYaml(manifest), "utf-8");

  if (template !== id) {
    const agentDir = join(dest, "harnesses", "opencode", "agents");
    const oldAgent = join(agentDir, `${template}.md`);
    const newAgent = join(agentDir, `${id}.md`);
    if (await pathExists(oldAgent)) {
      await rename(oldAgent, newAgent);
    }
    await replaceInTree(join(dest, "harnesses", "opencode"), template, id);
  }

  const infoPath = join(dest, "info.md");
  if (!(await pathExists(infoPath))) {
    await writeFile(
      infoPath,
      `# ${id}\n\n${description}\n`,
      "utf-8"
    );
  }

  return dest;
}