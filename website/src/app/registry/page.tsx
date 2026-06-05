import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import Header from "@/components/header";
import Footer from "@/components/footer";
import { listPublicRegistryItems } from "@/lib/registry/public";
import { KIND_COLORS, KIND_LABELS } from "@/lib/registry/labels";
import type { RegistryKind } from "@/lib/registry/types";

export const dynamic = "force-dynamic";

export default async function RegistryPage() {
  const items = await listPublicRegistryItems();

  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <Header />
      <main className="flex-1">
        <section className="mx-auto max-w-[1120px] px-6 pt-16 pb-12">
          <h1 className="text-[2.5rem] font-semibold leading-[1.05] tracking-[-0.035em] text-[var(--foreground)] md:text-[3rem]">
            Registry
          </h1>
          <p className="mt-4 max-w-xl text-[17px] leading-[1.65] text-muted">
            Browse specialized harnesses and agent packs. Install with the CLI after review.
          </p>
          <div className="mt-6 flex items-center gap-4">
            <Link
              href="/submit"
              className="inline-flex h-9 items-center rounded-full bg-[var(--foreground)] px-4 text-[13px] font-medium text-[var(--background)] hover:opacity-90 transition-opacity"
            >
              Publish
            </Link>
            <Link
              href="/docs/registry"
              className="inline-flex items-center gap-1 text-[13px] font-medium text-muted hover:text-[var(--foreground)]"
            >
              Install guide <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </section>

        <section className="mx-auto max-w-[1120px] px-6 pb-24">
          <div className="border-t border-default pt-8">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {items.map((item) => (
                <Link
                  key={item.id}
                  href={`/registry/${item.slug}`}
                  className="group flex flex-col rounded-xl border border-default bg-card p-5 hover:bg-[var(--card-hover)] transition-colors"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span
                      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium ${KIND_COLORS[item.kind as RegistryKind] ?? ""}`}
                    >
                      {KIND_LABELS[item.kind as RegistryKind] ?? item.kind}
                    </span>
                    <ArrowUpRight className="h-3.5 w-3.5 text-muted group-hover:text-[var(--foreground)]" />
                  </div>
                  <h3 className="text-[15px] font-semibold text-[var(--foreground)]">{item.name}</h3>
                  <p className="mt-2 text-[13px] leading-[1.55] text-muted line-clamp-2 flex-1">
                    {item.description}
                  </p>
                  <div className="mt-4 pt-3 border-t border-default flex justify-between text-[11px] text-muted font-mono">
                    <span>{item.slug}</span>
                    <span>View</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}