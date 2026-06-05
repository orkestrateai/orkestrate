#!/usr/bin/env bun
/**
 * Non-interactive smoke demo: scaffold demo-agent, validate, print launch hint.
 * Run from orkestrate/: bun run scripts/demo-pack-builder.ts
 */
import { join } from "node:path";
import { createPackFromTemplate } from "../src/sdk/packs/create";
import { validatePackLayout } from "../src/sdk/packs/store";
import { toPack, parsePackManifest } from "../src/sdk/packs/schema";
import { findPackManifestInDir, parseManifestYaml } from "../src/sdk/packs/fs";
import { getAdapter } from "../src/sdk/registry";
import { loadExtensions } from "../src/sdk/extensions/loader";

const DEMO_ID = "demo-agent";

await loadExtensions();

console.log("Orkestrate demo: pack scaffold + validate\n");

const dest = await createPackFromTemplate({
  id: DEMO_ID,
  template: "coding",
  description: "Demo pack from scripts/demo-pack-builder.ts",
  target: "workspace",
});

const manifestPath = await findPackManifestInDir(dest);
if (!manifestPath) throw new Error("pack.yaml missing after create");
const raw = await Bun.file(manifestPath).text();
const pack = toPack(parsePackManifest(parseManifestYaml(raw)), dest, manifestPath);

const { errors, warnings } = await validatePackLayout(pack);
for (const w of warnings) console.log(`⚠ ${w}`);
if (errors.length) {
  for (const e of errors) console.error(`✗ ${e}`);
  process.exit(1);
}

const adapter = getAdapter(pack.harness);
const status = adapter ? await adapter.detect() : { installed: false, error: "no driver" };
if (!status.installed) {
  console.error(`OpenCode not ready: ${status.error ?? "unknown"}`);
  process.exit(1);
}

console.log(`✓ Pack "${pack.id}" at ${dest}`);
console.log(`✓ Harness ${pack.harness} (${status.version ?? "ok"})\n`);
console.log("Launch manually:");
console.log(`  bun run src/cli/index.ts run launch ${DEMO_ID}`);
console.log(`\nPack home (sessions): ${join(process.cwd(), ".orkestrate", "pack-homes", DEMO_ID, "home")}`);