import DocsLayout from "@/components/DocsLayout";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Changelog",
};

const changelog = [
    {
        version: "0.3.0",
        date: "February 21, 2026",
        tag: "Latest",
        changes: [
            {
                type: "added" as const,
                items: [
                    "Documentation page with full setup guides for Claude Code, OpenCode, and Codex",
                    "Changelog page with version history",
                    "SVG logo and branded favicon",
                    "Open Graph image for social sharing previews",
                    "Runlayer-style 'How It Works' section with sticky sidebar navigation",
                    "Multi-section footer with navigation links",
                ],
            },
            {
                type: "improved" as const,
                items: [
                    "Client setup section now matches Supabase UI patterns",
                    "Per-client configuration with CLI commands, JSON/TOML configs, and auth flows",
                    "Metadata with OG tags, Twitter cards, and SEO best practices",
                ],
            },
        ],
    },
    {
        version: "0.2.0",
        date: "February 18, 2026",
        changes: [
            {
                type: "added" as const,
                items: [
                    "MCP client setup interface with dropdown selector",
                    "Support for Claude Code, OpenCode, and Codex clients",
                    "Copy-to-clipboard for all commands and configurations",
                    "OAuth 2.1 authentication flow with PKCE",
                    "Google sign-in via Supabase Auth",
                ],
            },
            {
                type: "improved" as const,
                items: [
                    "Landing page redesign with hero illustration",
                    "Room management dashboard for signed-in users",
                ],
            },
        ],
    },
    {
        version: "0.1.0",
        date: "February 14, 2026",
        changes: [
            {
                type: "added" as const,
                items: [
                    "Initial MCP server implementation",
                    "Shared workspace with key-value state (read, write, list, delete)",
                    "Room system — create, join, and switch between collaboration spaces",
                    "Supabase backend with PostgreSQL",
                    "OAuth 2.1 authorization server",
                    "Next.js landing page",
                ],
            },
        ],
    },
];

const typeColors = {
    added: { bg: "bg-[#34d399]/10", text: "text-[#34d399]", border: "border-[#34d399]/20", label: "Added" },
    improved: { bg: "bg-[#3b82f6]/10", text: "text-[#3b82f6]", border: "border-[#3b82f6]/20", label: "Improved" },
    fixed: { bg: "bg-[#f59e0b]/10", text: "text-[#f59e0b]", border: "border-[#f59e0b]/20", label: "Fixed" },
    removed: { bg: "bg-[#ef4444]/10", text: "text-[#ef4444]", border: "border-[#ef4444]/20", label: "Removed" },
};

export default function ChangelogPage() {
    return (
        <DocsLayout>
            <div className="mb-12">
                <p className="text-sm text-[#34d399] font-medium mb-2">Changelog</p>
                <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight mb-4">
                    What&apos;s New
                </h1>
                <p className="text-muted-foreground leading-relaxed text-lg">
                    Latest updates, improvements, and fixes to Orkestrate.
                </p>
            </div>

            <div className="space-y-0">
                {changelog.map((release, i) => (
                    <div key={release.version} className="relative">
                        {/* Timeline line */}
                        {i < changelog.length - 1 && (
                            <div className="absolute left-[7px] top-[28px] bottom-0 w-px bg-white/[0.06]" />
                        )}

                        <div className="flex gap-6 pb-16">
                            {/* Timeline dot */}
                            <div className="relative shrink-0 mt-[6px]">
                                <div className={`w-[15px] h-[15px] rounded-full border-2 ${i === 0 ? "border-[#34d399] bg-[#34d399]/20" : "border-white/20 bg-white/5"
                                    }`} />
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-3 mb-1">
                                    <h2 className="text-xl font-semibold">v{release.version}</h2>
                                    {release.tag && (
                                        <span className="text-[10px] font-mono tracking-wider uppercase px-2 py-0.5 rounded-full border border-[#34d399]/30 bg-[#34d399]/10 text-[#34d399]">
                                            {release.tag}
                                        </span>
                                    )}
                                </div>
                                <p className="text-sm text-muted-foreground mb-6">{release.date}</p>

                                <div className="space-y-6">
                                    {release.changes.map((group) => {
                                        const colors = typeColors[group.type];
                                        return (
                                            <div key={group.type}>
                                                <span className={`inline-block text-xs font-medium tracking-wider uppercase px-2 py-0.5 rounded ${colors.bg} ${colors.text} ${colors.border} border mb-3`}>
                                                    {colors.label}
                                                </span>
                                                <ul className="space-y-2">
                                                    {group.items.map((item, j) => (
                                                        <li key={j} className="flex gap-2 text-sm text-muted-foreground leading-relaxed">
                                                            <span className="text-white/20 mt-0.5 shrink-0">•</span>
                                                            <span>{item}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </DocsLayout>
    );
}

