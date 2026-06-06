import { tryCreateSupabaseAdminClient } from "@/lib/supabase/server";
import { BUNDLED_REGISTRY_PACKS } from "./bundled";
import type { RegistryApiItem, RegistryItemDetail } from "./types";

type SupabaseRegistryRow = {
  id: string;
  slug: string;
  kind: string;
  name: string;
  description: string;
  source_url: string;
  manifest_url: string | null;
  registry_versions?: Array<{
    manifest_json: unknown;
    version: string;
    status: string;
    created_at: string;
  }>;
};

function rowToApiItem(item: SupabaseRegistryRow): RegistryApiItem {
  const versions = Array.isArray(item.registry_versions) ? item.registry_versions : [];
  const approvedVersions = versions
    .filter((v) => v.status === "approved")
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const latestVersion = approvedVersions[0] ?? versions[0];

  const manifest =
    latestVersion?.manifest_json &&
    typeof latestVersion.manifest_json === "object" &&
    !Array.isArray(latestVersion.manifest_json)
      ? (latestVersion.manifest_json as Record<string, unknown>)
      : null;

  return {
    id: item.id,
    slug: item.slug,
    kind: item.kind as RegistryApiItem["kind"],
    name: item.name,
    description: item.description,
    source_url: item.source_url,
    manifest_url: item.manifest_url,
    version: latestVersion?.version ?? "0.1.0",
    manifest_json: manifest,
  };
}

async function fetchApprovedFromSupabase(): Promise<RegistryApiItem[]> {
  const supabase = tryCreateSupabaseAdminClient();
  if (!supabase) return [];

  const { data: items, error } = await supabase
    .from("registry_items")
    .select(`
      id, slug, kind, name, description, source_url, manifest_url,
      registry_versions ( manifest_json, version, status, created_at )
    `)
    .eq("status", "approved")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[registry] Supabase list failed", error);
    return [];
  }

  return (items ?? []).map((raw) => rowToApiItem(raw as SupabaseRegistryRow));
}

const OFFICIAL_BUNDLED_SLUGS = new Set(BUNDLED_REGISTRY_PACKS.map((item) => item.slug));

/** Bundled official packs plus approved community rows (official slugs always use bundled source). */
export async function listRegistryApiItems(): Promise<RegistryApiItem[]> {
  const remote = await fetchApprovedFromSupabase();
  const bySlug = new Map<string, RegistryApiItem>();

  for (const item of remote) {
    if (!OFFICIAL_BUNDLED_SLUGS.has(item.slug)) {
      bySlug.set(item.slug, item);
    }
  }
  for (const item of BUNDLED_REGISTRY_PACKS) {
    bySlug.set(item.slug, item);
  }

  return [...bySlug.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export async function getRegistryApiItem(slug: string): Promise<RegistryApiItem | null> {
  const items = await listRegistryApiItems();
  return items.find((item) => item.slug === slug) ?? null;
}