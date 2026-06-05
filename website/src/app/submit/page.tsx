import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { createSupabaseServerClient } from "@/lib/supabase/ssr";
import Header from "@/components/header";
import Footer from "@/components/footer";

export const dynamic = "force-dynamic";

const PACKAGE_KINDS = [
  ["pack", "Agent pack"],
  ["profile-pack", "Agent pack (legacy label)"],
  ["adapter", "Harness adapter"],
  ["skill-pack", "Skill pack"],
  ["mcp-pack", "MCP pack"],
  ["command-pack", "Command pack"],
] as const;

type PackageKind = (typeof PACKAGE_KINDS)[number][0];

const PACKAGE_KIND_SET = new Set<string>(PACKAGE_KINDS.map(([kind]) => kind));

function textValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function optionalUrl(value: string) {
  if (!value) return null;
  const url = new URL(value);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Only HTTP URLs are accepted.");
  }
  return url.toString();
}

function parseManifestJson(value: string) {
  if (!value) return null;
  const parsed = JSON.parse(value) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Manifest JSON must be an object.");
  }
  return parsed as Record<string, unknown>;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function validVersion(value: string) {
  return /^[0-9]+(?:\.[0-9]+){0,2}(?:[-+][a-z0-9.-]+)?$/i.test(value);
}

export async function submitRegistryPackage(formData: FormData) {
  "use server";

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/github");
  }

  const kind = textValue(formData, "kind");
  const requestedSlug = textValue(formData, "slug");
  const name = textValue(formData, "name");
  const description = textValue(formData, "description");
  const version = textValue(formData, "version") || "0.1.0";
  const sourceUrl = textValue(formData, "source_url");
  const manifestUrl = textValue(formData, "manifest_url");
  const manifestJson = textValue(formData, "manifest_json");
  const displayName = textValue(formData, "display_name");
  const githubHandle = textValue(formData, "github_handle").replace(/^@/, "");
  const websiteUrl = textValue(formData, "website_url");

  if (!PACKAGE_KIND_SET.has(kind)) {
    throw new Error("Unknown package type.");
  }

  if (name.length < 2 || name.length > 120) {
    throw new Error("Name must be 2-120 characters.");
  }

  const slug = slugify(requestedSlug || name);

  if (!slug) {
    throw new Error("Slug is required.");
  }

  if (!validVersion(version)) {
    throw new Error("Version must look like 0.1.0.");
  }

  if (description.length < 20 || description.length > 1200) {
    throw new Error("Description must be 20-1200 characters.");
  }

  if (!sourceUrl) {
    throw new Error("Source URL is required.");
  }

  const admin = createSupabaseAdminClient();
  const inferredDisplayName =
    displayName ||
    (typeof user.user_metadata.name === "string" && user.user_metadata.name) ||
    (typeof user.user_metadata.user_name === "string" && user.user_metadata.user_name) ||
    user.email ||
    "Orkestrate publisher";

  const inferredGithub =
    githubHandle ||
    (typeof user.user_metadata.user_name === "string" ? user.user_metadata.user_name : "");

  const { data: publisher, error: publisherError } = await admin
    .from("publisher_profiles")
    .upsert(
      {
        user_id: user.id,
        display_name: inferredDisplayName,
        github_handle: inferredGithub || null,
        website_url: optionalUrl(websiteUrl),
      },
      { onConflict: "user_id" },
    )
    .select("id")
    .single();

  if (publisherError || !publisher) {
    throw new Error("Could not save publisher profile.");
  }

  const normalizedSourceUrl = optionalUrl(sourceUrl) ?? sourceUrl;
  const normalizedManifestUrl = optionalUrl(manifestUrl);
  const parsedManifestJson = parseManifestJson(manifestJson) ?? {
    id: slug,
    kind,
    version,
    name,
    description,
  };

  const { data: item, error: itemError } = await admin
    .from("registry_items")
    .insert({
      slug,
      kind: kind as PackageKind,
      name,
      description,
      publisher_id: publisher.id,
      source_url: normalizedSourceUrl,
      manifest_url: normalizedManifestUrl,
      status: "pending",
    })
    .select("id")
    .single();

  if (itemError || !item) {
    throw new Error("Could not create pending registry item.");
  }

  const { data: registryVersion, error: versionError } = await admin
    .from("registry_versions")
    .insert({
      registry_item_id: item.id,
      version,
      manifest_json: parsedManifestJson,
      source_url: normalizedSourceUrl,
      status: "pending",
    })
    .select("id")
    .single();

  if (versionError || !registryVersion) {
    throw new Error("Could not create pending registry version.");
  }

  const { error: submissionError } = await admin.from("registry_submissions").insert({
    submitter_id: user.id,
    publisher_id: publisher.id,
    registry_item_id: item.id,
    registry_version_id: registryVersion.id,
    kind: kind as PackageKind,
    slug,
    name,
    description,
    version,
    source_url: normalizedSourceUrl,
    manifest_url: normalizedManifestUrl,
    manifest_json: parsedManifestJson,
  });

  if (submissionError) {
    throw new Error("Could not save registry submission.");
  }

  redirect("/submit?submitted=1");
}

export default async function SubmitPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const submitted = params.submitted === "1";
  const authError = params.auth === "error";
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const displayName =
    (typeof user?.user_metadata.name === "string" && user.user_metadata.name) ||
    (typeof user?.user_metadata.user_name === "string" && user.user_metadata.user_name) ||
    "";
  const githubHandle =
    (typeof user?.user_metadata.user_name === "string" && user.user_metadata.user_name) || "";

  return (
    <div className="flex min-h-screen flex-col bg-surface text-[var(--foreground)]">
      <Header />

      <main className="flex-1">
        <section className="mx-auto max-w-[1120px] px-6 pt-16 pb-24">
          <div className="grid gap-16 lg:grid-cols-[1fr_1.2fr]">
            {/* ─── Left: Info ─── */}
            <div>
              <h1 className="text-[2.5rem] md:text-[3rem] font-semibold leading-[1.08] tracking-[-0.035em]">
                Publish a package
              </h1>
              <p className="mt-4 text-[16px] leading-[1.65] text-muted">
                Submit a GitHub-hosted pack or extension to the Orkestrate registry. All submissions are manually reviewed before approval.
              </p>

              <div className="mt-10 space-y-6">
                <div className="flex gap-4">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#18181b] border border-default text-[11px] font-mono text-[#52525b]">1</div>
                  <div>
                    <p className="text-[14px] font-medium text-[var(--foreground)]">Validate locally</p>
                    <p className="mt-1 text-[13px] text-muted leading-[1.5]">Run <code className="text-muted bg-[#18181b] px-1.5 py-0.5 rounded text-[11px] font-mono">orkestrate pack validate .</code> or <code className="text-muted bg-[#18181b] px-1.5 py-0.5 rounded text-[11px] font-mono">orkestrate extension validate .</code> in your repo.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#18181b] border border-default text-[11px] font-mono text-[#52525b]">2</div>
                  <div>
                    <p className="text-[14px] font-medium text-[var(--foreground)]">Submit source and manifest</p>
                    <p className="mt-1 text-[13px] text-muted leading-[1.5]">Provide the GitHub repo URL and a <code className="text-muted bg-[#18181b] px-1.5 py-0.5 rounded text-[11px] font-mono">pack.yaml</code> or extension manifest with an <code className="text-muted bg-[#18181b] px-1.5 py-0.5 rounded text-[11px] font-mono">orkestrate</code> install block.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#18181b] border border-default text-[11px] font-mono text-[#52525b]">3</div>
                  <div>
                    <p className="text-[14px] font-medium text-[var(--foreground)]">Get approved</p>
                    <p className="mt-1 text-[13px] text-muted leading-[1.5]">Approved packages appear in the public registry and become installable via the CLI.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* ─── Right: Form ─── */}
            <div className="lg:border-l lg:border-default lg:pl-16">
              {submitted && (
                <div className="mb-6 border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-100 rounded-lg">
                  Submission received. It is now pending review.
                </div>
              )}

              {authError && (
                <div className="mb-6 border border-default bg-neutral-900/50 p-4 text-sm text-neutral-300 rounded-lg">
                  GitHub sign-in failed. Check the Supabase GitHub provider settings
                  and allowed redirect URLs.
                </div>
              )}

              {!user ? (
                <div>
                  <h2 className="text-xl font-semibold text-[var(--foreground)]">Sign in to publish</h2>
                  <p className="mt-3 text-[14px] leading-[1.6] text-muted">
                    Publishing requires GitHub identity so packages can be tied to a real maintainer. Browsing is open to everyone.
                  </p>
                  <Link
                    href="/auth/github"
                    className="mt-6 inline-flex h-10 items-center justify-center rounded-lg bg-[var(--foreground)] px-5 text-[13px] font-semibold text-[var(--background)] transition-all hover:bg-neutral-200"
                  >
                    Continue with GitHub
                  </Link>
                </div>
              ) : (
                <form action={submitRegistryPackage} className="grid gap-5">
                  <div className="flex items-start justify-between gap-4 border-b border-default pb-5">
                    <div>
                      <h2 className="text-xl font-semibold text-[var(--foreground)]">New package</h2>
                      <p className="mt-1 text-[13px] text-muted">
                        Signed in as {user.email ?? "GitHub publisher"}
                      </p>
                    </div>
                    <button
                      className="text-[13px] text-muted hover:text-[var(--foreground)] transition-colors cursor-pointer"
                      type="submit"
                      formAction="/auth/signout"
                      formMethod="post"
                      formNoValidate
                    >
                      Sign out
                    </button>
                  </div>

                  {/* Publisher info */}
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="grid gap-1.5 text-[13px] text-muted font-medium">
                      Display name
                      <input
                        name="display_name"
                        defaultValue={displayName}
                        required
                        maxLength={120}
                        className="h-10 border border-default bg-surface px-3 text-[14px] text-[var(--foreground)] outline-none focus:border-white/25 transition-all rounded-lg"
                      />
                    </label>
                    <label className="grid gap-1.5 text-[13px] text-muted font-medium">
                      GitHub handle
                      <input
                        name="github_handle"
                        defaultValue={githubHandle}
                        maxLength={80}
                        className="h-10 border border-default bg-surface px-3 text-[14px] text-[var(--foreground)] outline-none focus:border-white/25 transition-all rounded-lg"
                      />
                    </label>
                  </div>

                  <label className="grid gap-1.5 text-[13px] text-muted font-medium">
                    Publisher website
                    <input
                      name="website_url"
                      type="url"
                      placeholder="https://example.com"
                      className="h-10 border border-default bg-surface px-3 text-[14px] text-[var(--foreground)] outline-none focus:border-white/25 transition-all rounded-lg"
                    />
                  </label>

                  <div className="border-t border-default pt-5" />

                  {/* Package info */}
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="grid gap-1.5 text-[13px] text-muted font-medium">
                      Package type
                      <select
                        name="kind"
                        className="h-10 border border-default bg-surface px-3 text-[14px] text-[var(--foreground)] outline-none focus:border-white/25 transition-all rounded-lg cursor-pointer"
                      >
                        {PACKAGE_KINDS.map(([kind, label]) => (
                          <option key={kind} value={kind}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="grid gap-1.5 text-[13px] text-muted font-medium">
                      Package name
                      <input
                        name="name"
                        required
                        maxLength={120}
                        placeholder="math-research-pack"
                        className="h-10 border border-default bg-surface px-3 text-[14px] text-[var(--foreground)] outline-none focus:border-white/25 transition-all rounded-lg"
                      />
                    </label>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="grid gap-1.5 text-[13px] text-muted font-medium">
                      Registry slug
                      <input
                        name="slug"
                        maxLength={80}
                        placeholder="math-research-pack"
                        className="h-10 border border-default bg-surface px-3 text-[14px] text-[var(--foreground)] outline-none focus:border-white/25 transition-all rounded-lg"
                      />
                    </label>
                    <label className="grid gap-1.5 text-[13px] text-muted font-medium">
                      Version
                      <input
                        name="version"
                        defaultValue="0.1.0"
                        required
                        maxLength={40}
                        className="h-10 border border-default bg-surface px-3 text-[14px] text-[var(--foreground)] outline-none focus:border-white/25 transition-all rounded-lg"
                      />
                    </label>
                  </div>

                  <label className="grid gap-1.5 text-[13px] text-muted font-medium">
                    Description
                    <textarea
                      name="description"
                      required
                      minLength={20}
                      maxLength={1200}
                      rows={3}
                      placeholder="What does this package let people build or run?"
                      className="resize-y border border-default bg-surface p-3 text-[14px] text-[var(--foreground)] outline-none focus:border-white/25 transition-all rounded-lg"
                    />
                  </label>

                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="grid gap-1.5 text-[13px] text-muted font-medium">
                      Source URL
                      <input
                        name="source_url"
                        type="url"
                        required
                        placeholder="https://github.com/org/repo"
                        className="h-10 border border-default bg-surface px-3 text-[14px] text-[var(--foreground)] outline-none focus:border-white/25 transition-all rounded-lg"
                      />
                    </label>
                    <label className="grid gap-1.5 text-[13px] text-muted font-medium">
                      Manifest URL
                      <input
                        name="manifest_url"
                        type="url"
                        placeholder="https://raw.githubusercontent.com/..."
                        className="h-10 border border-default bg-surface px-3 text-[14px] text-[var(--foreground)] outline-none focus:border-white/25 transition-all rounded-lg"
                      />
                    </label>
                  </div>

                  <label className="grid gap-1.5 text-[13px] text-muted font-medium">
                    Manifest JSON
                    <textarea
                      name="manifest_json"
                      rows={6}
                      spellCheck={false}
                      placeholder='{ "id": "my-pack", "harness": "opencode", "orkestrate": { "ref": "main", "packPath": "packs/my-pack" } }'
                      className="resize-y border border-default bg-surface p-3 font-mono text-[13px] text-[var(--foreground)] outline-none focus:border-white/25 transition-all rounded-lg"
                    />
                  </label>

                  <button
                    type="submit"
                    className="h-10 rounded-lg bg-[var(--foreground)] px-5 text-[13px] font-semibold text-[var(--background)] transition-all hover:bg-neutral-200 cursor-pointer mt-1"
                  >
                    Submit for review
                  </button>
                </form>
              )}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
