"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Header from "@/components/header";
import Footer from "@/components/footer";
import TableOfContents from "@/components/TableOfContents";
import { DOC_NAV } from "@/lib/docs-nav";

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <Header />
      <div className="mx-auto flex w-full max-w-[1280px] flex-1 gap-0 px-6 py-10 lg:gap-10">
        <aside className="hidden w-56 shrink-0 lg:block">
          <nav className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto pr-2">
            {DOC_NAV.map((group) => (
              <div key={group.title} className="mb-6">
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
                  {group.title}
                </h3>
                <ul className="space-y-0.5">
                  {group.items.map((item) => {
                    const active = pathname === item.href;
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className={`block rounded-lg px-2.5 py-1.5 text-[13px] transition-colors ${
                            active
                              ? "bg-card font-medium text-[var(--foreground)]"
                              : "text-muted hover:bg-card hover:text-[var(--foreground)]"
                          }`}
                        >
                          {item.title}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 flex-1 max-w-[720px]">{children}</main>

        <aside className="hidden w-48 shrink-0 xl:block">
          <div className="sticky top-20">
            <TableOfContents />
          </div>
        </aside>
      </div>
      <Footer />
    </div>
  );
}