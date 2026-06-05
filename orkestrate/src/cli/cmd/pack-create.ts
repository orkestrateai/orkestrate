import { createPackFromTemplate } from "../../sdk/packs/create";
import { validatePackLayout } from "../../sdk/packs/store";
import { toPack, parsePackManifest } from "../../sdk/packs/schema";
import { findPackManifestInDir, parseManifestYaml } from "../../sdk/packs/fs";
import { PACK_MANIFEST } from "../../sdk/packs/paths";

export async function runPackCreate(
  id: string,
  options: { template?: string; description?: string; global?: boolean }
): Promise<void> {
  const dest = await createPackFromTemplate({
    id,
    template: options.template,
    description: options.description,
    target: options.global ? "global" : "workspace",
  });

  const manifestPath = await findPackManifestInDir(dest);
  if (!manifestPath) {
    throw new Error(`Created pack is missing ${PACK_MANIFEST}`);
  }
  const raw = await Bun.file(manifestPath).text();
  const manifest = parsePackManifest(parseManifestYaml(raw));
  const pack = toPack(manifest, dest, manifestPath);
  const { errors, warnings } = await validatePackLayout(pack);

  console.log(`Created pack at:\n  ${dest}\n`);
  if (warnings.length) {
    console.log("Warnings:");
    for (const w of warnings) console.log(`  ⚠ ${w}`);
  }
  if (errors.length) {
    console.log("Fix these before launch:");
    for (const e of errors) console.log(`  ✗ ${e}`);
    process.exitCode = 1;
    return;
  }

  console.log("Next:");
  console.log(`  orkestrate pack validate ${id}`);
  console.log(`  orkestrate run launch ${id}`);
  console.log(`  bun run dev   # TUI → select ${id} → Enter`);
}