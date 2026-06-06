import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/ssr";
import Header from "@/components/header";
import Footer from "@/components/footer";
import SubmitFlow from "./submit-flow";

export const dynamic = "force-dynamic";

export default async function SubmitPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const submitted = params.submitted === "1";
  const authError = params.auth === "error";
  const errorParam = typeof params.error === "string" ? decodeURIComponent(params.error) : undefined;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex min-h-screen flex-col bg-surface text-[var(--foreground)]">
      <Header />

      <main className="flex-1">
        <section className="mx-auto max-w-[1120px] px-6 pt-16 pb-24">
          <div className="grid gap-16 lg:grid-cols-[1fr_1.1fr]">
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">Registry</p>
              <h1 className="mt-2 text-[2.5rem] md:text-[3rem] font-semibold leading-[1.08] tracking-[-0.035em]">
                Publish a pack
              </h1>
              <p className="mt-4 text-[16px] leading-[1.65] text-muted">
                Paste your GitHub repo URL — we read <code className="font-mono text-[13px]">pack.yaml</code>{" "}
                and you confirm once. Manual review before it appears in the registry.
              </p>

              <div className="mt-10 space-y-6">
                <div className="flex gap-4">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#18181b] border border-default text-[11px] font-mono text-[#52525b]">
                    1
                  </div>
                  <div>
                    <p className="text-[14px] font-medium text-[var(--foreground)]">Validate locally</p>
                    <p className="mt-1 text-[13px] text-muted leading-[1.5]">
                      <code className="font-mono text-[11px] bg-[#18181b] px-1.5 py-0.5 rounded">
                        orkestrate pack validate .
                      </code>{" "}
                      in your pack directory.
                    </p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#18181b] border border-default text-[11px] font-mono text-[#52525b]">
                    2
                  </div>
                  <div>
                    <p className="text-[14px] font-medium text-[var(--foreground)]">Paste GitHub URL</p>
                    <p className="mt-1 text-[13px] text-muted leading-[1.5]">
                      We fetch <code className="font-mono text-[11px]">pack.yaml</code> from the default branch
                      (or your monorepo path).
                    </p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#18181b] border border-default text-[11px] font-mono text-[#52525b]">
                    3
                  </div>
                  <div>
                    <p className="text-[14px] font-medium text-[var(--foreground)]">Confirm & submit</p>
                    <p className="mt-1 text-[13px] text-muted leading-[1.5]">
                      Review slug, version, and description — one click to send for review.
                    </p>
                  </div>
                </div>
              </div>

              <p className="mt-8 text-[13px] text-muted">
                <Link href="/docs/publisher" className="underline underline-offset-2 hover:text-[var(--foreground)]">
                  Publisher guide
                </Link>{" "}
                — monorepo paths, manifest shape, review expectations.
              </p>
            </div>

            <div className="lg:border-l lg:border-default lg:pl-16">
              {submitted && (
                <div className="mb-6 border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-100 rounded-lg">
                  Submission received. It is pending review.
                </div>
              )}

              {authError && (
                <div className="mb-6 border border-default bg-neutral-900/50 p-4 text-sm text-neutral-300 rounded-lg">
                  GitHub sign-in failed. Check Supabase GitHub provider settings and redirect URLs.
                </div>
              )}

              {!user ? (
                <div>
                  <h2 className="text-xl font-semibold text-[var(--foreground)]">Sign in to publish</h2>
                  <p className="mt-3 text-[14px] leading-[1.6] text-muted">
                    GitHub sign-in ties submissions to a real maintainer. Browsing the registry is open to
                    everyone.
                  </p>
                  <Link
                    href="/auth/github"
                    className="mt-6 inline-flex h-10 items-center justify-center rounded-lg bg-[var(--foreground)] px-5 text-[13px] font-semibold text-[var(--background)] transition-all hover:bg-neutral-200"
                  >
                    Continue with GitHub
                  </Link>
                </div>
              ) : (
                <SubmitFlow userEmail={user.email ?? null} initialError={errorParam} />
              )}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}