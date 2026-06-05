export const REGISTRY_URL =
  process.env.ORKESTRATE_REGISTRY_URL || "https://orkestrate.space/api/registry";

export type RegistryItem = {
  id: string;
  slug: string;
  kind: string;
  name: string;
  description: string;
  source_url: string;
  manifest_url: string | null;
  version: string;
  manifest_json: unknown;
};

const PACK_KINDS = new Set(["profile-pack", "pack", "skill-pack"]);

export async function fetchRegistry(): Promise<RegistryItem[]> {
  try {
    const response = await fetch(REGISTRY_URL, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error(`Registry returned ${response.status} ${response.statusText}`);
    }
    return (await response.json()) as RegistryItem[];
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not reach registry at ${REGISTRY_URL}: ${message}`);
  }
}

export function isInstallablePackKind(kind: string): boolean {
  return PACK_KINDS.has(kind);
}

export async function fetchRegistryPackItems(): Promise<RegistryItem[]> {
  const items = await fetchRegistry();
  return items.filter((item) => isInstallablePackKind(item.kind) && item.source_url);
}