import Link from "next/link";
import Image from "next/image";
import Header from "@/components/header";
import Footer from "@/components/footer";
import { ArrowRight } from "lucide-react";
import HeroInstall from "@/components/hero-install";

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <Header />

      <main className="flex-1">
        <section className="mx-auto max-w-[900px] px-6 pt-20 pb-16 text-center md:pt-28">
          <p className="text-[13px] tracking-[-0.01em] text-muted">
            Agent packs
            <span className="mx-2.5 text-[var(--border)]">·</span>
            Task harnesses
            <span className="mx-2.5 text-[var(--border)]">·</span>
            Registry
          </p>
          <h1 className="mt-4 text-[2.5rem] font-semibold leading-[1.08] tracking-[-0.04em] text-[var(--foreground)] md:text-[3.25rem]">
            Browse, use, and share specialized harnesses.
          </h1>
          <p className="mx-auto mt-6 max-w-[540px] text-[17px] leading-[1.6] text-muted">
            Task-tuned execution for specialized agents — built by you or by the agent.
          </p>
          <HeroInstall />

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/docs/getting-started/quickstart"
              className="inline-flex h-10 items-center rounded-full bg-[var(--foreground)] px-5 text-[14px] font-medium text-[var(--background)] hover:opacity-90 transition-opacity"
            >
              Get started
            </Link>
            <Link
              href="/registry"
              className="inline-flex h-10 items-center rounded-full border border-default px-5 text-[14px] font-medium text-[var(--foreground)] hover:bg-card transition-colors"
            >
              Browse registry
            </Link>
          </div>
        </section>

        <section className="mx-auto max-w-[1120px] px-6 pb-20">
          <div className="relative aspect-[16/9] overflow-hidden rounded-[1.75rem] border border-default/60 shadow-[0_24px_80px_-24px_rgba(91,92,255,0.35)]">
            <div
              className="absolute inset-0 bg-[linear-gradient(135deg,#f4f2ff_0%,#faf9f7_42%,#f8f0ea_100%)] dark:bg-[linear-gradient(135deg,#12111a_0%,#0d0d0d_45%,#141018_100%)]"
              aria-hidden
            />
            <div
              className="absolute -left-[18%] top-[8%] h-[72%] w-[55%] rounded-full bg-[#5b5cff]/30 blur-[100px] dark:bg-[#7b7dff]/22"
              aria-hidden
            />
            <div
              className="absolute -right-[12%] bottom-[5%] h-[65%] w-[48%] rounded-full bg-[#e8c4a8]/35 blur-[110px] dark:bg-[#c49a6c]/18"
              aria-hidden
            />
            <div
              className="absolute left-[28%] top-[55%] h-[40%] w-[32%] rounded-full bg-[#a8b4ff]/25 blur-[80px] dark:bg-[#5b5cff]/12"
              aria-hidden
            />
            <div className="absolute inset-[6%] overflow-hidden rounded-2xl ring-1 ring-white/50 dark:ring-white/10">
              <Image
                src="/hero.png"
                alt="Orkestrate — specialized harnesses for agents"
                fill
                className="object-cover object-center"
                priority
              />
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1120px] px-6 pb-24">
          <h2 className="text-center text-[13px] font-semibold uppercase tracking-[0.12em] text-muted">
            The shift
          </h2>
          <p className="mx-auto mt-4 max-w-[640px] text-center text-[18px] leading-[1.55] text-[var(--foreground)]">
            One harness does not fit all work. Code review, research, and daily coding need different
            execution envelopes — tools, skills, and policy. Agents keep identity;{" "}
            <strong className="font-semibold">the harness slice changes with the task</strong>.
          </p>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {[
              {
                step: "Browse",
                body: "Discover harnesses and agent packs in the registry — inspect manifests before you install.",
              },
              {
                step: "Use",
                body: "Install with the CLI and launch on OpenCode in an isolated pack home. Sessions persist per agent.",
              },
              {
                step: "Share",
                body: "Publish packs and harness slices for others to install from GitHub-backed entries.",
              },
            ].map((item) => (
              <div
                key={item.step}
                className="rounded-xl border border-default bg-card p-6 transition-colors hover:bg-[var(--card-hover)]"
              >
                <h3 className="text-[17px] font-semibold text-[var(--foreground)]">{item.step}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-muted">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-y border-default bg-card">
          <div className="mx-auto max-w-[1120px] px-6 py-20">
            <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
              <div>
                <h2 className="text-[1.75rem] font-semibold tracking-[-0.03em] text-[var(--foreground)]">
                  For makers
                </h2>
                <p className="mt-4 text-[15px] leading-relaxed text-muted">
                  MCP authors, skill writers, and pack builders get a distribution surface. If your
                  expertise is not listed, it is not in the workflow.
                </p>
                <Link
                  href="/submit"
                  className="mt-6 inline-flex items-center gap-1 text-[14px] font-medium text-[var(--foreground)] underline decoration-[var(--border)] underline-offset-4 transition-colors hover:decoration-[var(--foreground)]"
                >
                  Publish to the registry <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
              <div className="rounded-xl border border-default bg-[var(--code-bg)] p-6 font-mono text-[13px] leading-[1.5] text-muted">
                <p className="text-[var(--foreground)]">orkestrate registry install coding</p>
                <p className="mt-2.5">orkestrate pack validate my-agent</p>
                <p className="mt-2.5">orkestrate run launch coding</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1120px] px-6 py-20 text-center">
          <h2 className="text-[1.75rem] font-semibold tracking-[-0.03em] text-[var(--foreground)]">
            Ready to publish or install?
          </h2>
          <p className="mx-auto mt-3 max-w-md text-[15px] text-muted">
            Read the docs, browse the catalog, or submit your first pack for review.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/docs"
              className="inline-flex h-10 items-center rounded-full border border-default px-5 text-[14px] font-medium hover:bg-card transition-colors"
            >
              Documentation
            </Link>
            <Link
              href="/submit"
              className="inline-flex h-10 items-center rounded-full bg-[var(--foreground)] px-5 text-[14px] font-medium text-[var(--background)] hover:opacity-90"
            >
              Publish a package
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}