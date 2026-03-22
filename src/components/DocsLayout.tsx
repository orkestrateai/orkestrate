"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/brand/Logo";

const nav = [
  {
    title: "Getting Started",
    items: [
      { label: "Overview", href: "/docs", hash: "" },
      { label: "Quickstart", href: "/docs#quickstart", hash: "quickstart" },
      { label: "Changelog", href: "/changelog", hash: "" },
    ],
  },
  {
    title: "Core Concepts",
    items: [
      { label: "How Orkestrate works", href: "/docs#how-it-works", hash: "how-it-works" },
      { label: "Workspaces", href: "/docs#workspaces", hash: "workspaces" },
      { label: "Shared State", href: "/docs#shared-state", hash: "shared-state" },
    ],
  },
  {
    title: "Setup",
    items: [
      { label: "Claude Code", href: "/docs#claude-code", hash: "claude-code" },
      { label: "OpenCode", href: "/docs#opencode", hash: "opencode" },
      { label: "Codex", href: "/docs#codex", hash: "codex" },
    ],
  },
  {
    title: "Authentication",
    items: [
      { label: "OAuth 2.1 Flow", href: "/docs#oauth", hash: "oauth" },
      { label: "Token Management", href: "/docs#tokens", hash: "tokens" },
    ],
  },
  {
    title: "API Reference",
    items: [
      { label: "MCP Tools", href: "/docs#mcp-tools", hash: "mcp-tools" },
      { label: "REST Endpoints", href: "/docs#rest-api", hash: "rest-api" },
    ],
  },
];

const allSectionIds = nav.flatMap((s) => s.items.map((i) => i.hash)).filter(Boolean);

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isDocsPage = pathname === "/docs";
  const [activeSection, setActiveSection] = useState("");

  useEffect(() => {
    if (!isDocsPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveSection(entry.target.id);
        }
      },
      { rootMargin: "-80px 0px -60% 0px", threshold: 0 },
    );

    const timer = setTimeout(() => {
      allSectionIds.forEach((id) => {
        const el = document.getElementById(id);
        if (el) observer.observe(el);
      });
    }, 100);

    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [isDocsPage]);

  useEffect(() => {
    const onHashChange = () => {
      const hash = window.location.hash.slice(1);
      if (hash) setActiveSection(hash);
    };
    window.addEventListener("hashchange", onHashChange);
    onHashChange();
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const getItemActive = (item: { href: string; hash: string }) => {
    if (item.href === "/changelog") return pathname === "/changelog";
    if (isDocsPage) {
      if (item.hash === "" && item.href === "/docs") return !activeSection;
      return item.hash === activeSection;
    }
    return pathname === item.href;
  };

  return (
    <div className="min-h-screen bg-[#111214] text-[#F2F2F2]">
      <div className="fixed inset-0 pointer-events-none opacity-60" style={{
        backgroundImage: "linear-gradient(to right, rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.02) 1px, transparent 1px)",
        backgroundSize: "56px 56px",
      }} />

      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 h-14 bg-[#111214]/85 backdrop-blur-xl border-b border-[#232529]">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2">
            <Logo size="sm" withText={true} />
            <span className="text-[12px] text-[#8A8F98] hidden sm:inline">Docs</span>
          </Link>
          <div className="hidden md:flex items-center gap-1 text-sm">
            <Link href="/docs" className={`px-3 py-1.5 rounded-[6px] transition-colors ${isDocsPage ? "text-[#F2F2F2] bg-[#1A1C20]" : "text-[#8A8F98] hover:text-[#F2F2F2]"}`}>
              Documentation
            </Link>
            <Link href="/changelog" className={`px-3 py-1.5 rounded-[6px] transition-colors ${pathname === "/changelog" ? "text-[#F2F2F2] bg-[#1A1C20]" : "text-[#8A8F98] hover:text-[#F2F2F2]"}`}>
              Changelog
            </Link>
          </div>
        </div>
        <Link href="/" className="text-[13px] text-[#8A8F98] hover:text-[#F2F2F2] transition-colors">
          Back to Home
        </Link>
      </nav>

      <div className="flex pt-14 relative z-10">
        <aside className="hidden md:block w-72 shrink-0 border-r border-[#232529] h-[calc(100vh-3.5rem)] sticky top-14 overflow-y-auto bg-[#16181A]/80">
          <div className="py-6 px-4 space-y-6">
            {nav.map((section) => (
              <div key={section.title}>
                <h4 className="text-[11px] font-semibold tracking-wider uppercase text-[#5E626B] mb-2 px-2">
                  {section.title}
                </h4>
                <ul className="space-y-0.5">
                  {section.items.map((item) => {
                    const isActive = getItemActive(item);
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={() => {
                            if (item.hash) setActiveSection(item.hash);
                            else if (item.href === "/docs") setActiveSection("");
                          }}
                          className={`block px-2.5 py-1.5 text-[13px] rounded-[6px] transition-colors ${isActive
                            ? "text-[#F2F2F2] bg-[#1A1C20] border border-[#2A2D32]"
                            : "text-[#8A8F98] hover:text-[#F2F2F2] hover:bg-[#1A1C20]"
                            }`}
                        >
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </aside>

        <main className="flex-1 min-w-0">
          <div className="max-w-4xl mx-auto px-6 md:px-12 py-12">{children}</div>
        </main>
      </div>
    </div>
  );
}

