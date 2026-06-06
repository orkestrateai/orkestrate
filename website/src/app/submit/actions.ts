"use server";

import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { createSupabaseServerClient } from "@/lib/supabase/ssr";
import {
  buildRegistryManifestJson,
  inspectGithubPack,
  slugify,
  validVersion,
} from "@/lib/submit/github-pack";

const SUBMIT_PATH = "/submit";

export type InspectPackResult =
  | {
      ok: true;
      inspected: Awaited<ReturnType<typeof inspectGithubPack>>;
      slug: string;
    }
  | { ok: false; error: string };

export async function inspectPackAction(
  _prev: InspectPackResult | null,
  formData: FormData
): Promise<InspectPackResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/github");
  }

  const githubUrl = String(formData.get("github_url") ?? "").trim();
  const ref = String(formData.get("git_ref") ?? "").trim();
  const packPath = String(formData.get("pack_path") ?? "").trim();

  if (!githubUrl) {
    return { ok: false, error: "GitHub URL is required." };
  }

  try {
    const inspected = await inspectGithubPack(githubUrl, {
      ref: ref || undefined,
      packPath: packPath || undefined,
    });
    const slug = slugify(inspected.pack.id);
    if (!slug) {
      return { ok: false, error: "pack.yaml id must produce a valid registry slug." };
    }
    if (!validVersion(inspected.pack.version)) {
      return { ok: false, error: "pack.yaml version must look like 0.1.0." };
    }
    if (inspected.pack.description.length > 1200) {
      return { ok: false, error: "pack.yaml description must be under 1200 characters." };
    }
    return { ok: true, inspected, slug };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load pack.yaml.";
    return { ok: false, error: message };
  }
}

export async function confirmSubmitAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/github");
  }

  const githubUrl = String(formData.get("github_url") ?? "").trim();
  const ref = String(formData.get("git_ref") ?? "").trim();
  const packPath = String(formData.get("pack_path") ?? "").trim();

  let inspected;
  try {
    inspected = await inspectGithubPack(githubUrl, {
      ref: ref || undefined,
      packPath: packPath || undefined,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not verify pack.yaml.";
    redirect(`${SUBMIT_PATH}?error=${encodeURIComponent(message)}`);
  }

  const { pack, github } = inspected;
  const slug = slugify(pack.id);
  const kind = pack.harness === "opencode" ? "pack" : "pack";

  const admin = createSupabaseAdminClient();
  const displayName =
    (typeof user.user_metadata.name === "string" && user.user_metadata.name) ||
    (typeof user.user_metadata.user_name === "string" && user.user_metadata.user_name) ||
    user.email ||
    "Orkestrate publisher";
  const githubHandle =
    typeof user.user_metadata.user_name === "string" ? user.user_metadata.user_name : null;

  const { data: publisher, error: publisherError } = await admin
    .from("publisher_profiles")
    .upsert(
      {
        user_id: user.id,
        display_name: displayName,
        github_handle: githubHandle,
        website_url: null,
      },
      { onConflict: "user_id" }
    )
    .select("id")
    .single();

  if (publisherError || !publisher) {
    redirect(`${SUBMIT_PATH}?error=${encodeURIComponent("Could not save publisher profile.")}`);
  }

  const manifestJson = buildRegistryManifestJson(pack, github);

  const { data: item, error: itemError } = await admin
    .from("registry_items")
    .insert({
      slug,
      kind,
      name: pack.name,
      description: pack.description,
      publisher_id: publisher.id,
      source_url: github.webUrl,
      manifest_url: inspected.rawUrl,
      status: "pending",
    })
    .select("id")
    .single();

  if (itemError || !item) {
    const msg =
      itemError?.code === "23505"
        ? "This slug is already registered. Bump version or contact support."
        : "Could not create pending registry item.";
    redirect(`${SUBMIT_PATH}?error=${encodeURIComponent(msg)}`);
  }

  const { data: registryVersion, error: versionError } = await admin
    .from("registry_versions")
    .insert({
      registry_item_id: item.id,
      version: pack.version,
      manifest_json: manifestJson,
      source_url: github.webUrl,
      status: "pending",
    })
    .select("id")
    .single();

  if (versionError || !registryVersion) {
    redirect(`${SUBMIT_PATH}?error=${encodeURIComponent("Could not create pending registry version.")}`);
  }

  const { error: submissionError } = await admin.from("registry_submissions").insert({
    submitter_id: user.id,
    publisher_id: publisher.id,
    registry_item_id: item.id,
    registry_version_id: registryVersion.id,
    kind,
    slug,
    name: pack.name,
    description: pack.description,
    version: pack.version,
    source_url: github.webUrl,
    manifest_url: inspected.rawUrl,
    manifest_json: manifestJson,
  });

  if (submissionError) {
    redirect(`${SUBMIT_PATH}?error=${encodeURIComponent("Could not save registry submission.")}`);
  }

  redirect(`${SUBMIT_PATH}?submitted=1`);
}