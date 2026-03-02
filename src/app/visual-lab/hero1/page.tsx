'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Logo } from '@/components/brand/Logo';

// Dynamically import CubeGrid to avoid SSR issues with Three.js
const CubeGrid = dynamic(() => import('./CubeGrid'), {
    ssr: false,
    loading: () => (
        <div className="w-full h-full min-h-[500px] flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-white/10 border-t-white/40 rounded-full animate-spin" />
        </div>
    ),
});

export default function HeroPage() {
    return (
        <main className="min-h-screen bg-black text-white overflow-x-hidden">

            {/* ═══ NAVBAR ═══ */}
            <nav className="relative z-50 flex items-center justify-between px-6 py-5 md:px-12 lg:px-20 max-w-[1400px] mx-auto">
                <div className="flex items-center gap-8">
                    <Link href="/visual-lab" className="hover:opacity-80 transition-opacity">
                        <Logo size="sm" withText={true} />
                    </Link>

                    <div className="hidden md:flex items-center gap-6">
                        <Link href="#" className="text-sm text-white/50 hover:text-white transition-colors">Features</Link>
                        <Link href="#" className="text-sm text-white/50 hover:text-white transition-colors">Company</Link>
                        <Link href="#" className="text-sm text-white/50 hover:text-white transition-colors">Resources</Link>
                        <Link href="#" className="text-sm text-white/50 hover:text-white transition-colors">Help</Link>
                        <Link href="#" className="text-sm text-white/50 hover:text-white transition-colors">Docs</Link>
                        <Link href="#" className="text-sm text-white/50 hover:text-white transition-colors">Pricing</Link>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <Link href="#" className="hidden md:block text-sm text-white/50 hover:text-white transition-colors">
                        Log In
                    </Link>
                    <button className="bg-white text-black hover:bg-white/90 transition-colors px-4 py-2 rounded-md text-sm font-semibold">
                        Get Started
                    </button>
                </div>
            </nav>

            {/* ═══ HERO SECTION ═══ */}
            <section className="relative z-10 px-6 md:px-12 lg:px-20 max-w-[1400px] mx-auto">
                <div className="grid grid-cols-1 lg:grid-cols-2 items-center min-h-[calc(100vh-80px)] gap-8 lg:gap-0">

                    {/* Left — Text Content */}
                    <div className="flex flex-col justify-center gap-8 pt-12 lg:pt-0">

                        {/* Serif heading — Resend-style large italic serif  */}
                        <h1
                            className="text-[clamp(3.5rem,7vw,7rem)] leading-[1.05] tracking-[-0.03em]"
                            style={{ fontFamily: "var(--font-fraunces), 'Georgia', 'Times New Roman', serif" }}
                        >
                            <span className="block font-light italic">Orchestrate</span>
                            <span className="block font-light italic">your agents</span>
                        </h1>

                        {/* Subtitle */}
                        <p className="text-white/40 text-base md:text-lg leading-relaxed max-w-md font-light">
                            The best way to coordinate AI coding agents
                            instead of managing conflicts.
                            <br />
                            Deliver autonomous collaboration at scale.
                        </p>

                        {/* CTAs */}
                        <div className="flex items-center gap-6 pt-2">
                            <button className="bg-white text-black hover:bg-white/90 transition-all px-6 py-3.5 rounded-lg text-sm font-bold">
                                Get Started
                            </button>
                            <Link href="#" className="text-sm text-white/50 hover:text-white transition-colors font-medium">
                                Documentation
                            </Link>
                        </div>
                    </div>

                    {/* Right — 3D Cube Grid */}
                    <div className="relative flex items-center justify-center lg:justify-end h-[500px] lg:h-[600px]">
                        {/* Subtle ambient glow behind the cubes */}
                        <div className="absolute inset-0 pointer-events-none">
                            <div
                                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[80%] rounded-full opacity-20"
                                style={{
                                    background: 'radial-gradient(circle, rgba(50,50,60,0.4) 0%, transparent 70%)',
                                }}
                            />
                        </div>

                        <div className="w-full h-full">
                            <CubeGrid />
                        </div>
                    </div>
                </div>
            </section>

            {/* Bottom gradient fade — like Resend */}
            <div
                className="fixed bottom-0 left-0 right-0 h-32 pointer-events-none z-20"
                style={{
                    background: 'linear-gradient(to top, black 0%, transparent 100%)',
                }}
            />
        </main>
    );
}