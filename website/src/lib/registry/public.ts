import { createSupabaseAdminClient, tryCreateSupabaseAdminClient } from "@/lib/supabase/server";
import { getBundledRegistryDetail } from "./bundled";
import { getRegistryApiItem, listRegistryApiItems } from "./catalog";
import type { RegistryApiItem, RegistryItemDetail, RegistryKind } from "./types";

export type { RegistryApiItem, RegistryKind };

export type PublicRegistryItem = Pick<
  RegistryApiItem,
  "id" | "slug" | "kind" | "name" | "description" | "source_url" | "manifest_url"
>;

export async function listPublicRegistryItems(): Promise<PublicRegistryItem[]> {
  const items = await listRegistryApiItems();
  return items.map(({ id, slug, kind, name, description, source_url, manifest_url }) => ({
    id,
    slug,
    kind,
    name,
    description,
    source_url,
    manifest_url,
  }));
}

export type PublicRegistryItemDetail = RegistryItemDetail;

export async function getPublicRegistryItemDetail(
  slug: string
): Promise<PublicRegistryItemDetail | null> {
  const bundled = getBundledRegistryDetail(slug);
  const supabase = tryCreateSupabaseAdminClient();

  if (!supabase) {
    return bundled;
  }

  try {
    const { data, error: itemError } = await supabase
      .from("registry_items")
      .select(`
        id, slug, kind, name, description, source_url, manifest_url, created_at,
        publisher:publisher_profiles(display_name, github_handle, website_url)
      `)
      .eq("slug", slug)
      .eq("status", "approved")
      .maybeSingle();

    const item = data as Record<string, unknown> | null;

    if (itemError || !item) {
      return bundled;
    }

    const { data: version, error: versionError } = await supabase
      .from("registry_versions")
      .select("version, manifest_json, source_url, created_at")
      .eq("registry_item_id", item.id as string)
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (versionError) {
      console.error("[registry] failed to load latest version for item", versionError);
    }

    const catalogItem = await getRegistryApiItem(slug);
    const manifest =
      version?.manifest_json &&
      typeof version.manifest_json === "object" &&
      !Array.isArray(version.manifest_json)
        ? (version.manifest_json as Record<string, unknown>)
        : (catalogItem?.manifest_json ?? bundled?.latest_version?.manifest_json ?? null);

    return {
      id: item.id as string,
      slug: item.slug as string,
      kind: item.kind as RegistryKind,
      name: item.name as string,
      description: item.description as string,
      source_url: item.source_url as string,
      manifest_url: (item.manifest_url as string | null) ?? null,
      version: version?.version ?? catalogItem?.version ?? "0.1.0",
      manifest_json: manifest,
      created_at: item.created_at as string,
      publisher: (item.publisher as PublicRegistryItemDetail["publisher"]) ?? null,
      latest_version: version
        ? {
            version: version.version,
            manifest_json: manifest,
            source_url: version.source_url,
            created_at: version.created_at,
          }
        : bundled?.latest_version ?? null,
    };
  } catch (error) {
    console.error("[registry] registry detail retrieval unavailable", error);
    return bundled;
  }
}