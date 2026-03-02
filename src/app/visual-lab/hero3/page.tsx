"use client";

import { useState } from "react";
import Link from "next/link";
import { MoveLeft, ArrowRight, Github } from "lucide-react";

type ToolType = 'codex' | 'claude' | 'opencode';

export default function Hero3Page() {
    const [activeTool, setActiveTool] = useState<ToolType>('opencode');

    // Dynamic video filters based on the active tool
    const videoFilter =
        activeTool === 'claude' ? 'hue-rotate-[-30deg] saturate-[1.2] contrast-[1.05] brightness-[1.05]' :
            activeTool === 'codex' ? 'hue-rotate-[100deg] saturate-[1.3] contrast-[1.05] brightness-[0.95]' :
                'hue-rotate-0 saturate-100 contrast-100 brightness-100';

    return (
        <main className="h-screen bg-black text-white selection:bg-white/30 selection:text-white overflow-hidden relative">

            {/* ═══ NAVBAR (Moved up into layout flow mimicking Hero2) ═══ */}
            <nav className="absolute top-0 left-0 w-full z-50 flex items-center justify-between px-6 py-5 md:px-12 lg:px-20 max-w-[1400px] left-1/2 -translate-x-1/2 mix-blend-difference">
                <div className="flex items-center gap-8">
                    <Link href="/visual-lab" className="hover:opacity-80 transition-opacity flex items-center gap-2">
                        <MoveLeft className="w-4 h-4 text-white/60" />
                        <span className="font-bold tracking-tight">Orkestrate</span>
                    </Link>
                    <div className="hidden md:flex items-center gap-6">
                        <Link href="#" className="text-sm text-white/40 hover:text-white transition-colors">Features</Link>
                        <Link href="#" className="text-sm text-white/40 hover:text-white transition-colors">Docs</Link>
                        <Link href="#" className="text-sm text-white/40 hover:text-white transition-colors">Pricing</Link>
                        <Link href="#" className="text-sm text-white/40 hover:text-white transition-colors">GitHub</Link>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <Link href="#" className="hidden md:block text-sm text-white/40 hover:text-white transition-colors">
                        Log In
                    </Link>
                    <button className="bg-white text-black hover:bg-white/90 transition-all px-4 py-2 rounded-md text-sm font-semibold">
                        Get Started
                    </button>
                </div>
            </nav>

            {/* ═══ HERO — Split Layout: Text L, Shape R ═══ */}
            <section className="relative h-full flex items-center">

                {/* Video Canvas — Fullscreen absolute behind content to prevent clipping! */}
                <div className="absolute inset-0 z-0 pointer-events-none w-full h-full flex items-center justify-center overflow-hidden">
                    <video
                        autoPlay
                        loop
                        muted
                        playsInline
                        className={`absolute inset-0 w-fit h-fit -top-[10%] object-fit opacity-90 transition-all duration-1000 ease-in-out ${videoFilter}`}
                    >
                        <source src="/Unicorn_startup_looping_animation_delpmaspu_.mp4" type="video/mp4" />
                    </video>
                    {/* A stronger gradient overlay to push the video back visually */}
                    <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-transparent z-10" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent z-10" />
                </div>

                <div className="relative z-20 px-6 md:px-12 lg:px-20 max-w-[1400px] mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-12 items-center pointer-events-none h-full pt-20">

                    {/* Left Column: Text & Instructions */}
                    <div className="max-w-2xl xl:max-w-3xl space-y-8 pointer-events-auto">
                        {/* Removed Beta Badge */}

                        {/* Heading */}
                        <h1
                            className="text-[clamp(3.5rem,5.5vw,5.5rem)] leading-[1] font-bold tracking-tight text-[#EEEEEE] drop-shadow-2xl whitespace-nowrap"
                        >
                            <span className="block mb-2">The product development</span>
                            <span className="block text-white">system for teams and agents</span>
                        </h1>

                        {/* Subtitle */}
                        <p className="text-[#888888] text-lg leading-relaxed max-w-[28rem] font-medium tracking-wide drop-shadow-md">
                            Purpose-built for planning and building products. Designed for the AI era.
                        </p>

                        {/* Interactive Installation Box - Linear Aesthetic */}
                        <div className="mt-12 rounded-xl border border-white/[0.08] bg-[#0A0A0A]/80 backdrop-blur-3xl overflow-hidden shadow-[0_20px_40px_-20px_rgba(0,0,0,1)] max-w-md">
                            {/* Tabs */}
                            <div className="flex items-center px-4 py-3 border-b border-white/[0.04] gap-2">
                                <button
                                    onClick={() => setActiveTool('opencode')}
                                    className={`relative z-10 px-3 py-1.5 rounded-md text-[13px] font-medium transition-all duration-200 ${activeTool === 'opencode'
                                        ? 'text-white bg-white/[0.08] shadow-sm'
                                        : 'text-[#888888] hover:text-[#EEEEEE] hover:bg-white/[0.04]'
                                        }`}
                                >
                                    OpenCode
                                </button>
                                <button
                                    onClick={() => setActiveTool('claude')}
                                    className={`relative z-10 px-3 py-1.5 rounded-md text-[13px] font-medium transition-all duration-200 ${activeTool === 'claude'
                                        ? 'text-white bg-white/[0.08] shadow-sm'
                                        : 'text-[#888888] hover:text-[#EEEEEE] hover:bg-white/[0.04]'
                                        }`}
                                >
                                    Claude Code
                                </button>
                                <button
                                    onClick={() => setActiveTool('codex')}
                                    className={`relative z-10 px-3 py-1.5 rounded-md text-[13px] font-medium transition-all duration-200 ${activeTool === 'codex'
                                        ? 'text-white bg-white/[0.08] shadow-sm'
                                        : 'text-[#888888] hover:text-[#EEEEEE] hover:bg-white/[0.04]'
                                        }`}
                                >
                                    Codex
                                </button>
                            </div>

                            {/* Instruction Content */}
                            <div className="p-6">
                                <div className="mb-5">
                                    <h3 className="text-[#EEEEEE] font-medium text-[14px] mb-1.5 track-tight">
                                        Install {activeTool === 'opencode' ? 'OpenCode' : activeTool === 'claude' ? 'Claude Code' : 'Codex'} Integration
                                    </h3>
                                    <p className="text-[#888888] text-[13px] leading-relaxed">
                                        Run this command in your terminal to synchronize {activeTool} with your Orchestrate workspace.
                                    </p>
                                </div>

                                <div className="flex items-center justify-between gap-3 px-4 py-3 bg-[#111111] border border-white/[0.06] rounded-[6px] font-mono text-[13px] group hover:border-white/[0.15] transition-all cursor-pointer">
                                    <div className="flex items-center gap-3">
                                        <span className="opacity-30 select-none text-[#888888]">$</span>
                                        <span className="text-[#EEEEEE] group-hover:text-white transition-colors">
                                            bunx orkestrate add {activeTool}
                                        </span>
                                    </div>
                                    <button className="text-[#555555] hover:text-[#EEEEEE] transition-colors flex items-center justify-center rounded">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                                    </button>
                                </div>
                            </div>
                        </div>

                    </div>

                    {/* Right Column: Empty space just to push the text left via grid layout. Added pointer-events-auto if interaction is needed */}
                    <div className="hidden lg:block relative h-[600px] w-full pointer-events-auto" />
                </div>
            </section>

        </main>
    );
}
