import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { getPublicRegistryItemDetail } from "@/lib/registry/public";
import { KIND_LABELS } from "@/lib/registry/labels";
import type { RegistryKind } from "@/lib/registry/types";
import type { Metadata } from "next";
import Header from "@/components/header";
import Footer from "@/components/footer";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const item = await getPublicRegistryItemDetail(slug);
  if (!item) return { title: "Not found" };
  return { title: item.name, description: item.description };
}

export default async function RegistryItemPage({ params }: PageProps) {
  const { slug } = await params;
  const item = await getPublicRegistryItemDetail(slug);
  if (!item) notFound();

  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <Header />
      <main className="mx-auto max-w-[1120px] w-full px-6 py-12">
        <Link
          href="/registry"
          className="inline-flex items-center gap-2 text-sm text-muted hover:text-[var(--foreground)]"
        >
          <ArrowLeft className="h-4 w-4" /> Registry
        </Link>

        <div className="mt-8 grid gap-12 lg:grid-cols-[1.5fr_1fr]">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted">
              {KIND_LABELS[item.kind as RegistryKind] ?? item.kind} · v{item.version}
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-[-0.03em] text-[var(--foreground)]">
              {item.name}
            </h1>
            <p className="mt-4 text-[16px] leading-relaxed text-muted whitespace-pre-wrap">
              {item.description}
            </p>

            <div className="mt-10">
              <h2 className="text-sm font-medium uppercase tracking-[0.08em] text-muted">Install</h2>
              <div className="mt-3 rounded-xl border border-default bg-card p-4 font-mono text-sm text-[var(--foreground)]">
                orkestrate registry install {item.slug}
              </div>
            </div>

            {item.latest_version?.manifest_json && (
              <div className="mt-10">
                <h2 className="text-sm font-medium uppercase tracking-[0.08em] text-muted">Manifest</h2>
                <pre className="mt-3 overflow-x-auto rounded-xl border border-default bg-card p-4 font-mono text-[13px] text-muted">
                  {JSON.stringify(item.latest_version.manifest_json, null, 2)}
                </pre>
              </div>
            )}
          </div>

          <aside className="space-y-8">
            <div className="border-t border-default pt-6 lg:border-t-0 lg:pt-0">
              <h3 className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted">Publisher</h3>
              <p className="mt-2 font-semibold text-[var(--foreground)]">
                {item.publisher?.display_name ?? "Orkestrate"}
              </p>
            </div>
            <div className="border-t border-default pt-6">
              <h3 className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted">Links</h3>
              <a
                href={item.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-2 text-sm text-muted hover:text-[var(--foreground)]"
              >
                <ExternalLink className="h-4 w-4" /> Source repository
              </a>
            </div>
          </aside>
        </div>
      </main>
      <Footer />
    </div>
  );
}