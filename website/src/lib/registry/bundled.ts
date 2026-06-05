import type { RegistryApiItem, RegistryItemDetail } from "./types";

/** Monorepo URL used for install-from-GitHub in the public registry API. */
export const BUNDLED_REPO_URL =
  process.env.ORKESTRATE_BUNDLED_REPO_URL?.trim() ||
  process.env.NEXT_PUBLIC_ORKESTRATE_REPO_URL?.trim() ||
  "https://github.com/system1970/Orkestrate";

const BUNDLED_REF = process.env.ORKESTRATE_BUNDLED_REPO_REF?.trim() || "main";

function packManifest(
  id: string,
  name: string,
  description: string,
  packPath: string
): Record<string, unknown> {
  return {
    id,
    name,
    description,
    harness: "opencode",
    version: "0.1.0",
    orkestrate: {
      ref: BUNDLED_REF,
      packPath,
    },
  };
}

/** Official packs shipped in the CLI; always exposed via the registry API. */
export const BUNDLED_REGISTRY_PACKS: RegistryApiItem[] = [
  {
    id: "bundled:coding",
    slug: "coding",
    kind: "pack",
    name: "Coding",
    description:
      "General-purpose coding agent for day-to-day software work. OpenCode harness with Orkestrate launch wiring.",
    source_url: BUNDLED_REPO_URL,
    manifest_url: null,
    version: "0.1.0",
    manifest_json: packManifest(
      "coding",
      "coding",
      "General-purpose coding agent for day-to-day software work.",
      "orkestrate/packs/coding"
    ),
  },
  {
    id: "bundled:extension-builder",
    slug: "extension-builder",
    kind: "pack",
    name: "Extension builder",
    description:
      "Meta pack for authoring Orkestrate packs, drivers, and platform extensions with guided skills.",
    source_url: BUNDLED_REPO_URL,
    manifest_url: null,
    version: "0.1.0",
    manifest_json: packManifest(
      "extension-builder",
      "extension-builder",
      "Build Orkestrate packs, drivers, and platform extensions.",
      "orkestrate/packs/extension-builder"
    ),
  },
];

const BUNDLED_BY_SLUG = new Map(BUNDLED_REGISTRY_PACKS.map((item) => [item.slug, item]));

export function getBundledRegistryItem(slug: string): RegistryApiItem | undefined {
  return BUNDLED_BY_SLUG.get(slug);
}

export function getBundledRegistryDetail(slug: string): RegistryItemDetail | null {
  const item = getBundledRegistryItem(slug);
  if (!item) return null;

  return {
    ...item,
    created_at: new Date(0).toISOString(),
    publisher: {
      display_name: "Orkestrate",
      github_handle: "orkestrate",
      website_url: "https://orkestrate.space",
    },
    latest_version: {
      version: item.version,
      manifest_json: item.manifest_json,
      source_url: item.source_url,
      created_at: new Date(0).toISOString(),
    },
  };
}