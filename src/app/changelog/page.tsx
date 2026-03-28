import DocsLayout from "@/components/DocsLayout";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Changelog | Orkestrate",
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

const typeStyles = {
    added: { 
        bg: "bg-white/[0.04]", 
        text: "text-[#EBEBEB]", 
        border: "border-white/[0.1]", 
        label: "Added" 
    },
    improved: { 
        bg: "bg-[#0A0A0B]", 
        text: "text-[#8A8F98]", 
        border: "border-white/[0.05]", 
        label: "Improved" 
    },
    fixed: { 
        bg: "bg-transparent", 
        text: "text-[#5E626B]", 
        border: "border-dashed border-white/[0.05]", 
        label: "Fixed" 
    },
    removed: { 
        bg: "bg-transparent", 
        text: "text-[#5E626B] line-through", 
        border: "border border-white/[0.02]", 
        label: "Removed" 
    },
};

export default function ChangelogPage() {
    return (
        <DocsLayout>
            <div className="max-w-4xl mx-auto pt-8 pb-32">
                {/* Header Sequence */}
                <div className="mb-24">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.03] border border-white/[0.08] mb-6">
                        <span className="w-1.5 h-1.5 rounded-full bg-white/[0.5] animate-pulse" />
                        <span className="text-[10px] font-sans font-medium tracking-widest uppercase text-[#8A8F98]">
                            Transmission Log
                        </span>
                    </div>
                    <h1 className="text-4xl md:text-5xl font-light tracking-tight text-[#EBEBEB] mb-5">
                        Changelog
                    </h1>
                    <p className="text-lg text-[#5E626B] leading-relaxed max-w-2xl font-light">
                        New updates and improvements to the Orkestrate protocol.
                    </p>
                </div>

                {/* Release History */}
                <div className="space-y-24">
                    {changelog.map((release) => (
                        <div key={release.version} className="relative md:flex md:gap-12 group">
                            
                            {/* Left: Version & Date (Sticky on Desktop) */}
                            <div className="md:w-48 shrink-0 pb-6 md:pb-0 relative z-10">
                                <div className="sticky top-32">
                                    <div className="flex items-center gap-3 mb-2">
                                        <h2 className="text-xl font-medium text-[#EBEBEB] tracking-tight">
                                            v{release.version}
                                        </h2>
                                        {release.tag && (
                                            <span className="text-[9px] font-sans font-medium tracking-[0.2em] uppercase px-2 py-0.5 rounded-full border border-white/[0.1] bg-white/[0.04] text-[#EBEBEB]">
                                                {release.tag}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-[13px] text-[#5E626B] font-sans">
                                        {release.date}
                                    </p>
                                </div>
                            </div>

                            {/* Right: Changes Content */}
                            <div className="flex-1 relative">
                                {/* Subtle divider line for structural framing */}
                                <div className="absolute -left-6 md:-left-12 top-2 bottom-0 w-px bg-gradient-to-b from-white/[0.08] via-white/[0.02] to-transparent hidden md:block group-last:from-transparent" />
                                
                                <div className="space-y-12">
                                    {release.changes.map((group) => {
                                        const style = typeStyles[group.type];
                                        return (
                                            <div key={group.type} className="relative">
                                                {/* Bullet connecting to the divider line */}
                                                <div className="hidden md:block absolute -left-[50px] top-2.5 w-1.5 h-1.5 rounded-full bg-[#16181A] border border-[#3A3F4A]" />

                                                <span className={`inline-flex items-center px-2 py-1 rounded-[4px] text-[10px] font-sans font-medium tracking-widest uppercase border ${style.bg} ${style.text} ${style.border} mb-6`}>
                                                    {style.label}
                                                </span>
                                                
                                                <ul className="space-y-4">
                                                    {group.items.map((item, j) => (
                                                        <li key={j} className="flex items-start gap-4 group/item">
                                                            <div className="mt-2.5 w-1 h-1 rounded-full bg-[#3A3F4A] shrink-0 group-hover/item:bg-[#8A8F98] transition-colors" />
                                                            <span className="text-[14px] text-[#8A8F98] leading-relaxed group-hover/item:text-[#D1D3D8] transition-colors duration-300">
                                                                {item}
                                                            </span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                        </div>
                    ))}
                </div>
            </div>
        </DocsLayout>
    );
}
