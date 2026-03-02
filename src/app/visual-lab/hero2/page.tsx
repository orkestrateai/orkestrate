'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Logo } from '@/components/brand/Logo';

const ShaderHero = dynamic<{ activeTool: string }>(() => import('./ShaderHero'), {
    ssr: false,
    loading: () => (
        <div className="w-full h-full min-h-[600px] flex items-center justify-center">
            <div className="w-10 h-10 border-2 border-white/5 border-t-white/30 rounded-full animate-spin" />
        </div>
    ),
});

type ToolType = 'codex' | 'claude' | 'opencode';

export default function Hero2Page() {
    const [activeTool, setActiveTool] = useState<ToolType>('opencode');
    return (
        <main className="min-h-screen bg-black text-white overflow-hidden relative">

            {/* ═══ NAVBAR ═══ */}
            <nav className="relative z-50 flex items-center justify-between px-6 py-5 md:px-12 lg:px-20 max-w-[1400px] mx-auto">
                <div className="flex items-center gap-8">
                    <Link href="/visual-lab" className="hover:opacity-80 transition-opacity">
                        <Logo size="sm" withText={true} />
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
            <section className="relative min-h-[calc(100vh-80px)] flex items-center">

                {/* Background ambient lighting */}
                <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />
                <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-sky-600/10 rounded-full blur-[100px] pointer-events-none" />

                {/* 3D Shader Canvas — Fullscreen absolute behind content to prevent clipping! */}
                <div className="absolute inset-0 z-0 pointer-events-none w-full h-full flex items-center justify-center overflow-hidden">
                    <ShaderHero activeTool={activeTool} />
                </div>

                <div className="relative z-10 px-6 md:px-12 lg:px-20 max-w-[1400px] mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-12 items-center pointer-events-none min-h-[600px]">

                    {/* Left Column: Text & Instructions */}
                    <div className="max-w-xl space-y-8 pointer-events-auto">
                        {/* Badge */}
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 backdrop-blur-sm">
                            <span className="relative flex h-1.5 w-1.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-indigo-400" />
                            </span>
                            <span className="text-white/50 text-[11px] uppercase font-medium tracking-widest">Now in Beta</span>
                        </div>

                        {/* Heading */}
                        <h1
                            className="text-[clamp(3rem,5vw,5.5rem)] leading-[1.05] tracking-[-0.03em]"
                            style={{ fontFamily: "var(--font-fraunces), Georgia, serif" }}
                        >
                            <span className="block font-light italic text-white">Orchestrate</span>
                            <span className="block font-light italic text-white/80">your agents</span>
                        </h1>

                        {/* Subtitle */}
                        <p className="text-white/40 text-base md:text-lg leading-relaxed max-w-md font-light">
                            Connect your AI coding agents to a shared coordination layer.
                            Instantly sync state across your favorite dev tools.
                        </p>

                        {/* Interactive Installation Box */}
                        <div className="mt-12 rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-md overflow-hidden">
                            {/* Tabs */}
                            <div className="flex items-center border-b border-white/10 p-2 gap-2 bg-black/20">
                                <button
                                    onClick={() => setActiveTool('opencode')}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${activeTool === 'opencode'
                                        ? 'bg-white/10 text-white shadow-sm'
                                        : 'text-white/40 hover:text-white hover:bg-white/5'
                                        }`}
                                >
                                    OpenCode
                                </button>
                                <button
                                    onClick={() => setActiveTool('claude')}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${activeTool === 'claude'
                                        ? 'bg-white/10 text-white shadow-sm'
                                        : 'text-white/40 hover:text-white hover:bg-white/5'
                                        }`}
                                >
                                    Claude Code
                                </button>
                                <button
                                    onClick={() => setActiveTool('codex')}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${activeTool === 'codex'
                                        ? 'bg-white/10 text-white shadow-sm'
                                        : 'text-white/40 hover:text-white hover:bg-white/5'
                                        }`}
                                >
                                    Codex
                                </button>
                            </div>

                            {/* Instruction Content */}
                            <div className="p-6">
                                <div className="mb-4">
                                    <h3 className="text-white/80 font-medium text-sm mb-1">
                                        Install {activeTool === 'opencode' ? 'OpenCode' : activeTool === 'claude' ? 'Claude Code' : 'Codex'} Integration
                                    </h3>
                                    <p className="text-white/40 text-xs">
                                        Run this command in your terminal to synchronize {activeTool} with your Orchestrate workspace.
                                    </p>
                                </div>

                                <div className="flex items-center justify-between gap-3 px-4 py-3 bg-black/40 border border-white/5 rounded-lg font-mono text-sm group hover:border-white/20 transition-all cursor-copy">
                                    <div className="flex items-center gap-3">
                                        <span className="opacity-30 select-none">$</span>
                                        <span className="text-white/70 group-hover:text-white transition-colors">
                                            bunx orkestrate add {activeTool}
                                        </span>
                                    </div>
                                    <button className="text-white/20 hover:text-white transition-colors">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                                    </button>
                                </div>
                            </div>
                        </div>

                    </div>

                    {/* Right Column: Empty space just to push the text left via grid layout. Added pointer-events-auto so you can interact with the hidden 3D object behind it if OrbitControls was added later. */}
                    <div className="hidden lg:block relative h-[600px] w-full pointer-events-auto" />
                </div>
            </section>

        </main>
    );
}
