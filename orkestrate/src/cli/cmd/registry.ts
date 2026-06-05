import {
  installCatalogPack,
  listBundledCatalog,
  listFullCatalog,
  listRegistryCatalog,
} from "../../sdk/packs/catalog";
import { REGISTRY_URL } from "../../sdk/packs/registry";

export async function runRegistryList(): Promise<void> {
  const bundled = await listBundledCatalog();
  console.log("Bundled packs:\n");
  for (const e of bundled) {
    console.log(`  ${e.slug}  ${e.pack.description}`);
  }

  try {
    const remote = await listRegistryCatalog();
    if (remote.length === 0) {
      console.log(`\nRegistry (${REGISTRY_URL}): no installable packs.`);
      return;
    }
    console.log(`\nRegistry (${REGISTRY_URL}):\n`);
    for (const e of remote) {
      const tag = e.installed ? " [installed]" : "";
      console.log(`  ${e.slug}${tag}  ${e.description ?? e.pack.description}`);
      if (e.github) console.log(`    ${e.github}`);
    }
  } catch (error) {
    console.warn(`\nRegistry unavailable: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function runRegistrySearch(query: string): Promise<void> {
  const q = query.toLowerCase();
  const all = await listFullCatalog();
  const hits = all.filter(
    (e) =>
      e.slug.toLowerCase().includes(q) ||
      e.pack.id.toLowerCase().includes(q) ||
      e.pack.description.toLowerCase().includes(q) ||
      (e.pack.name && e.pack.name.toLowerCase().includes(q))
  );

  if (hits.length === 0) {
    console.log(`No packs matching "${query}".`);
    return;
  }

  for (const e of hits) {
    const src = e.source === "registry" ? "registry" : "bundled";
    console.log(`${e.slug}  (${src})${e.installed ? " [installed]" : ""}`);
    console.log(`  ${e.pack.description}`);
  }
}

export async function runRegistryInstall(
  slug: string,
  options?: { global?: boolean; overwrite?: boolean }
): Promise<void> {
  const pack = await installCatalogPack(slug, {
    target: options?.global ? "global" : "workspace",
    overwrite: options?.overwrite,
  });
  console.log(`Installed pack: ${pack.id}`);
  console.log(`  ${pack.packRoot}`);
}