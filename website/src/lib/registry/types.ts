export type RegistryKind =
  | "pack"
  | "profile-pack"
  | "adapter"
  | "skill-pack"
  | "mcp-pack"
  | "command-pack";

export type RegistryApiItem = {
  id: string;
  slug: string;
  kind: RegistryKind;
  name: string;
  description: string;
  source_url: string;
  manifest_url: string | null;
  version: string;
  manifest_json: Record<string, unknown> | null;
};

export type RegistryPublisher = {
  display_name: string;
  github_handle: string | null;
  website_url: string | null;
};

export type RegistryItemDetail = RegistryApiItem & {
  created_at: string;
  publisher: RegistryPublisher | null;
  latest_version: {
    version: string;
    manifest_json: Record<string, unknown> | null;
    source_url: string;
    created_at: string;
  } | null;
};