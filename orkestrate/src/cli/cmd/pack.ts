import { installCatalogPack, listBundledCatalog, listInstalledPacks } from "../../sdk/packs/catalog";
import { resolvePack, validatePackLayout } from "../../sdk/packs/store";
import { seedBundledToGlobalIfMissing } from "../../sdk/packs/store";

export async function runPackList(): Promise<void> {
  await seedBundledToGlobalIfMissing();
  const installed = await listInstalledPacks();
  console.log("Installed packs:\n");
  for (const { pack, scope } of installed) {
    console.log(`  ${pack.id}  (${scope})  harness=${pack.harness}`);
    console.log(`    ${pack.description}`);
  }
  const bundled = await listBundledCatalog();
  const notInstalled = bundled.filter((b) => !b.installed);
  if (notInstalled.length > 0) {
    console.log("\nBundled catalog (not installed):\n");
    for (const entry of notInstalled) {
      console.log(`  ${entry.slug}`);
    }
  }
}

export async function runPackInstall(slug: string, global = false): Promise<void> {
  const pack = await installCatalogPack(slug, { target: global ? "global" : "workspace" });
  console.log(`Installed pack: ${pack.id}`);
  console.log(`  ${pack.packRoot}`);
}

export async function runPackValidate(packId: string): Promise<void> {
  const pack = await resolvePack(packId);
  const { errors, warnings } = await validatePackLayout(pack);
  const adapter = (await import("../../sdk/registry")).getAdapter(pack.harness);
  if (!adapter) {
    errors.push(`No driver for harness "${pack.harness}"`);
  } else {
    const status = await adapter.detect();
    if (!status.installed) {
      errors.push(`Harness not installed: ${status.error ?? "unknown"}`);
    }
  }
  if (warnings.length) {
    console.log("Warnings:");
    for (const w of warnings) console.log(`  ⚠ ${w}`);
  }
  if (errors.length) {
    console.error("Validation failed:");
    for (const e of errors) console.error(`  ✗ ${e}`);
    process.exitCode = 1;
    return;
  }
  console.log(`Pack "${pack.id}" is valid.`);
  console.log(`  ${pack.packRoot}`);
}