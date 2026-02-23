"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

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
            { label: "How Agentalk works", href: "/docs#how-it-works", hash: "how-it-works" },
            { label: "Rooms & Workspaces", href: "/docs#rooms", hash: "rooms" },
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

// Collect all section IDs from nav
const allSectionIds = nav.flatMap((s) => s.items.map((i) => i.hash)).filter(Boolean);

export default function DocsLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const isDocsPage = pathname === "/docs";
    const [activeSection, setActiveSection] = useState("");

    // Track which section is visible via IntersectionObserver
    useEffect(() => {
        if (!isDocsPage) return;

        const observer = new IntersectionObserver(
            (entries) => {
                // Find the first entry that is intersecting
                for (const entry of entries) {
                    if (entry.isIntersecting) {
                        setActiveSection(entry.target.id);
                    }
                }
            },
            { rootMargin: "-80px 0px -60% 0px", threshold: 0 }
        );

        // Small delay to ensure DOM is ready
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

    // Also track hash changes from clicks
    useEffect(() => {
        const onHashChange = () => {
            const hash = window.location.hash.slice(1);
            if (hash) setActiveSection(hash);
        };
        window.addEventListener("hashchange", onHashChange);
        // Set initial hash
        onHashChange();
        return () => window.removeEventListener("hashchange", onHashChange);
    }, []);

    const getItemActive = (item: { href: string; hash: string }) => {
        // Changelog page
        if (item.href === "/changelog") return pathname === "/changelog";
        // On docs page — match by section
        if (isDocsPage) {
            if (item.hash === "" && item.href === "/docs") return !activeSection;
            return item.hash === activeSection;
        }
        // Fallback: pathname match
        return pathname === item.href;
    };

    return (
        <div className="min-h-screen bg-background text-foreground">
            {/* Top navbar */}
            <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 h-14 bg-background/80 backdrop-blur-xl border-b border-white/[0.06]">
                <div className="flex items-center gap-6">
                    <Link href="/" className="flex items-center gap-2">
                        <svg width="20" height="20" viewBox="0 0 32 32" fill="none" className="shrink-0">
                            <path d="M8 13 C8 10.5, 10 9, 13 9 L17 9 C19.5 9, 21 10.5, 21 13 L21 16 C21 18.5, 19.5 19.5, 17 19.5 L14.5 19.5 L12 22 L12.5 19.5 L11 19.5 C9.5 19.5, 8 18.5, 8 16 Z" fill="#34d399" opacity="0.9" />
                            <path d="M12 14 C12 11.8, 13.8 10.5, 16 10.5 L20 10.5 C22.5 10.5, 24 11.8, 24 14 L24 17 C24 19, 22.5 20, 20 20 L19.5 20 L20 22.5 L17.5 20 L16 20 C13.8 20, 12 19, 12 17 Z" fill="currentColor" stroke="#34d399" strokeWidth="1.2" className="text-background" />
                            <circle cx="16.5" cy="15.5" r="1.2" fill="#34d399" />
                            <circle cx="19" cy="15.5" r="1.2" fill="#34d399" />
                            <circle cx="21.5" cy="15.5" r="1.2" fill="#34d399" />
                        </svg>
                        <span className="text-sm font-semibold">Agentalk Docs</span>
                    </Link>

                    <div className="hidden md:flex items-center gap-1 text-sm">
                        <Link href="/docs" className={`px-3 py-1.5 rounded-md transition-colors ${isDocsPage ? "text-foreground bg-white/[0.06]" : "text-muted-foreground hover:text-foreground"}`}>
                            Documentation
                        </Link>
                        <Link href="/changelog" className={`px-3 py-1.5 rounded-md transition-colors ${pathname === "/changelog" ? "text-foreground bg-white/[0.06]" : "text-muted-foreground hover:text-foreground"}`}>
                            Changelog
                        </Link>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                        Back to Home
                    </Link>
                </div>
            </nav>

            <div className="flex pt-14">
                {/* Sidebar */}
                <aside className="hidden md:block w-64 shrink-0 border-r border-white/[0.06] h-[calc(100vh-3.5rem)] sticky top-14 overflow-y-auto">
                    <div className="py-6 px-4 space-y-6">
                        {nav.map((section) => (
                            <div key={section.title}>
                                <h4 className="text-xs font-medium tracking-wider uppercase text-muted-foreground mb-2 px-2">
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
                                                    className={`block px-2 py-1.5 text-sm rounded-md transition-colors ${isActive
                                                            ? "text-foreground bg-white/[0.06] font-medium"
                                                            : "text-muted-foreground hover:text-foreground hover:bg-white/[0.03]"
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

                {/* Main content */}
                <main className="flex-1 min-w-0">
                    <div className="max-w-3xl mx-auto px-6 md:px-12 py-12">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
