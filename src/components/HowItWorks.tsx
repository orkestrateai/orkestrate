"use client";
import { useState, useEffect } from "react";

// ─────────────────────────────────────────────
// Animated SVG Components
// ─────────────────────────────────────────────

const ConnectSVG = () => (
    <svg viewBox="0 0 400 250" className="w-full h-full bg-[#030303]">
        <defs>
            <filter id="glow1" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                </feMerge>
            </filter>
            <pattern id="grid1" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
            </pattern>
        </defs>

        {/* Background Grid */}
        <rect width="400" height="250" fill="url(#grid1)" />

        {/* Local Agent Box */}
        <g transform="translate(60, 85)">
            <rect width="80" height="80" rx="8" fill="#080808" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
            <path d="M25,30 L40,40 L25,50" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <line x1="45" y1="50" x2="60" y2="50" stroke="#fff" strokeWidth="2" strokeLinecap="round">
                <animate attributeName="opacity" values="1;0;1" dur="1s" repeatCount="indefinite" />
            </line>
            <text x="40" y="-12" fill="#a1a1aa" fontSize="10" fontWeight="600" textAnchor="middle" letterSpacing="0.1em">LOCAL AGENT</text>
        </g>

        {/* MCP Server Box */}
        <g transform="translate(260, 85)">
            <rect width="80" height="80" rx="8" fill="#050505" stroke="#a855f7" strokeWidth="1.5" filter="drop-shadow(0 0 8px rgba(168,85,247,0.2))" />
            <rect x="25" y="25" width="30" height="8" rx="2" fill="none" stroke="#a855f7" strokeWidth="1.5" />
            <rect x="25" y="45" width="30" height="8" rx="2" fill="none" stroke="#a855f7" strokeWidth="1.5" />
            <circle cx="30" cy="29" r="1.5" fill="#a855f7" />
            <circle cx="30" cy="49" r="1.5" fill="#a855f7" />
            <text x="40" y="-12" fill="#a855f7" fontSize="10" fontWeight="600" textAnchor="middle" letterSpacing="0.1em">MCP SERVER</text>
        </g>

        {/* Connecting Wire */}
        <path id="connect-wire" d="M140,125 L260,125" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="2" strokeDasharray="4 4" />

        {/* Animated Data Packets */}
        <circle r="3" fill="#fff" filter="url(#glow1)">
            <animateMotion dur="1.5s" repeatCount="indefinite" path="M140,125 L260,125" />
        </circle>
        <circle r="3" fill="#a855f7" filter="url(#glow1)">
            <animateMotion dur="1.5s" repeatCount="indefinite" path="M260,125 L140,125" />
        </circle>

        {/* Connection Nodes */}
        <circle cx="140" cy="125" r="4" fill="#080808" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" />
        <circle cx="260" cy="125" r="4" fill="#050505" stroke="#a855f7" strokeWidth="1.5" />
    </svg>
);

const ShareSVG = () => (
    <svg viewBox="0 0 400 250" className="w-full h-full bg-[#030303]">
        <defs>
            <filter id="glow2" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="5" result="blur" />
                <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                </feMerge>
            </filter>
            <pattern id="grid2" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
            </pattern>
        </defs>

        {/* Background Grid */}
        <rect width="400" height="250" fill="url(#grid2)" />

        {/* Radiating Room Waves */}
        <g transform="translate(200, 125)">
            <circle cx="0" cy="0" r="20" fill="none" stroke="#a855f7" strokeWidth="1.5">
                <animate attributeName="r" values="20; 100" dur="2s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.8; 0" dur="2s" repeatCount="indefinite" />
            </circle>
            <circle cx="0" cy="0" r="20" fill="none" stroke="#a855f7" strokeWidth="1.5">
                <animate attributeName="r" values="20; 100" dur="2s" begin="1s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.8; 0" dur="2s" begin="1s" repeatCount="indefinite" />
            </circle>
        </g>

        {/* Satellite Nodes */}
        {[
            { x: 80, y: 60, delay: "0s" },
            { x: 320, y: 60, delay: "0.5s" },
            { x: 200, y: 200, delay: "1s" }
        ].map((node, i) => (
            <g key={i}>
                <line x1="200" y1="125" x2={node.x} y2={node.y} stroke="rgba(255,255,255,0.1)" strokeWidth="1.5" strokeDasharray="4 4" />
                <circle r="2.5" fill="#fff">
                    <animateMotion dur="1.5s" begin={node.delay} repeatCount="indefinite" path={`M200,125 L${node.x},${node.y}`} />
                </circle>
                <circle cx={node.x} cy={node.y} r="16" fill="#080808" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
                <circle cx={node.x} cy={node.y} r="6" fill="#a1a1aa" />
            </g>
        ))}

        {/* Central Room Badge */}
        <g transform="translate(160, 105)">
            <rect width="80" height="40" rx="20" fill="#050505" stroke="#a855f7" strokeWidth="2" filter="url(#glow2)" />
            <text x="40" y="24" fill="#fff" fontSize="12" fontWeight="700" textAnchor="middle" letterSpacing="0.1em">ROOM_ID</text>
        </g>
    </svg>
);

const CollaborateSVG = () => (
    <svg viewBox="0 0 400 250" className="w-full h-full bg-[#030303]">
        <defs>
            <filter id="glow3" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="6" result="blur" />
                <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                </feMerge>
            </filter>
            <pattern id="grid3" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
            </pattern>
            {/* Triangular Path for Sync Loop */}
            <path id="sync-loop" d="M 200 60 L 300 180 L 100 180 Z" fill="none" />
        </defs>

        {/* Background Grid */}
        <rect width="400" height="250" fill="url(#grid3)" />

        {/* Central State Hexagon */}
        <g transform="translate(200, 130) scale(1.2)">
            <polygon points="0,-25 22,-12.5 22,12.5 0,25 -22,12.5 -22,-12.5" fill="#000" stroke="#a855f7" strokeWidth="1.5" filter="url(#glow3)" />
            <circle cx="0" cy="0" r="6" fill="#a855f7" />
            <circle cx="0" cy="0" r="14" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1" strokeDasharray="2 2">
                <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="4s" repeatCount="indefinite" />
            </circle>
        </g>
        <text x="200" y="180" fill="#a855f7" fontSize="10" fontWeight="700" textAnchor="middle" letterSpacing="0.1em">SHARED STATE</text>

        {/* Sync Ring */}
        <circle cx="200" cy="130" r="80" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2" strokeDasharray="8 8" />

        {/* Agents on the ring */}
        {[
            { x: 200, y: 50, label: "Claude Code", iconUrl: "https://cdn.brandfetch.io/idmJWF3N06/theme/light/symbol.svg?c=1bxid64Mup7aczewSAYMX&t=1721803183866", labelOffset: -32 },
            { x: 130, y: 170, label: "OpenCode", iconUrl: "https://cdn.brandfetch.io/id8ixWaeze/w/180/h/180/theme/dark/logo.png?c=1bxid64Mup7aczewSAYMX&t=1768205132942", labelOffset: 35 },
            { x: 270, y: 170, label: "Codex", iconUrl: "https://cdn.brandfetch.io/idR3duQxYl/theme/light/symbol.svg?c=1bxid64Mup7aczewSAYMX&t=1749527480180", labelOffset: 35 }
        ].map((agent, i) => (
            <g key={i}>
                {/* Connector to center */}
                <line x1="200" y1="130" x2={agent.x} y2={agent.y} stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />

                {/* Bi-directional glowing packets */}
                <circle r="2.5" fill="#a855f7" filter="url(#glow3)">
                    <animateMotion dur="2s" begin={`${i * 0.3}s`} repeatCount="indefinite" path={`M${agent.x},${agent.y} L200,130`} />
                </circle>
                <circle r="2.5" fill="#fff" filter="url(#glow3)">
                    <animateMotion dur="2s" begin={`${i * 0.3 + 1}s`} repeatCount="indefinite" path={`M200,130 L${agent.x},${agent.y}`} />
                </circle>

                {/* Agent Node */}
                <circle cx={agent.x} cy={agent.y} r="20" fill="#080808" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
                <image href={agent.iconUrl} x={agent.x - 8} y={agent.y - 8} width="16" height="16" preserveAspectRatio="xMidYMid meet" />
                <text x={agent.x} y={agent.y + agent.labelOffset} fill="#a1a1aa" fontSize="10" fontWeight="600" textAnchor="middle" letterSpacing="0.05em">{agent.label}</text>
            </g>
        ))}

        {/* Orbiting Sync Indicator */}
        <circle cx="200" cy="50" r="4" fill="#a855f7" filter="url(#glow3)">
            <animateTransform attributeName="transform" type="rotate" from="0 200 130" to="360 200 130" dur="4s" repeatCount="indefinite" />
        </circle>
    </svg>
);


// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────

export function HowItWorks() {
    const [activeFeature, setActiveFeature] = useState("connect");

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        const id = entry.target.id.replace("feature-", "");
                        setActiveFeature(id);
                    }
                });
            },
            { rootMargin: "-40% 0px -40% 0px" }
        );
        ["connect", "share", "collaborate"].forEach((id) => {
            const el = document.getElementById(`feature-${id}`);
            if (el) observer.observe(el);
        });
        return () => observer.disconnect();
    }, []);

    return (
        <section className="relative z-10 py-24 md:py-32 border-t border-white/[0.06] bg-[#000]">
            <div className="max-w-6xl mx-auto px-6 md:px-12">
                <div className="flex flex-col md:flex-row gap-12 md:gap-20">

                    {/* Left Column — Sticky */}
                    <div className="md:w-[340px] shrink-0">
                        <div className="md:sticky md:top-32">
                            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight mb-4 text-white">
                                How It Works
                            </h2>
                            <p className="text-zinc-400 mb-10 leading-relaxed">
                                Three steps to collaborative AI agents with shared workspace state.
                            </p>

                            {/* Feature Nav */}
                            <div className="hidden md:flex flex-col gap-1">
                                {[
                                    { id: "connect", label: "Connect" },
                                    { id: "share", label: "Share" },
                                    { id: "collaborate", label: "Collaborate" },
                                ].map((item) => (
                                    <button
                                        key={item.id}
                                        onClick={() => document.getElementById(`feature-${item.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}
                                        className={`text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-300 ${activeFeature === item.id
                                            ? "text-white bg-white/[0.06] border-l-2 border-[#a855f7]"
                                            : "text-zinc-500 hover:text-white hover:bg-white/[0.03]"
                                            }`}
                                    >
                                        {item.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Right Column — Scrolling Feature Cards */}
                    <div className="flex-1 space-y-20 md:space-y-32">

                        {/* Feature 1: Connect */}
                        <div id="feature-connect" className="scroll-mt-32">
                            <div className="rounded-2xl border border-white/[0.08] bg-[#050505] overflow-hidden mb-6 max-w-md mx-auto shadow-2xl">
                                <div className="aspect-[16/10] relative">
                                    <ConnectSVG />
                                </div>
                            </div>
                            <h3 className="text-xl font-semibold mb-2 text-white">Connect</h3>
                            <p className="text-zinc-400 leading-relaxed">
                                Add the MCP endpoint to your agent in one command. Works with Claude Code, Codex, OpenCode, and any MCP-compatible client. No SDK, no dependencies — just a URL.
                            </p>
                        </div>

                        {/* Feature 2: Share */}
                        <div id="feature-share" className="scroll-mt-32">
                            <div className="rounded-2xl border border-white/[0.08] bg-[#050505] overflow-hidden mb-6 max-w-md mx-auto shadow-2xl">
                                <div className="aspect-[16/10] relative">
                                    <ShareSVG />
                                </div>
                            </div>
                            <h3 className="text-xl font-semibold mb-2 text-white">Share</h3>
                            <p className="text-zinc-400 leading-relaxed">
                                Create a room and share the ID with your team. Each room is an isolated workspace with its own state. No complex setup—just a simple code to connect.
                            </p>
                        </div>

                        {/* Feature 3: Collaborate */}
                        <div id="feature-collaborate" className="scroll-mt-32">
                            <div className="rounded-2xl border border-white/[0.08] bg-[#050505] overflow-hidden mb-6 max-w-md mx-auto shadow-2xl">
                                <div className="aspect-[16/10] relative">
                                    <CollaborateSVG />
                                </div>
                            </div>
                            <h3 className="text-xl font-semibold mb-2 text-white">Collaborate</h3>
                            <p className="text-zinc-400 leading-relaxed">
                                Every connected agent reads and writes the same workspace. Real-time state synchronization across tools—no merge conflicts, no stale data.
                            </p>
                        </div>

                    </div>
                </div>
            </div>
        </section>
    );
}