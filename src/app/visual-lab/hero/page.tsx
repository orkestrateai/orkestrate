"use client";

import Link from "next/link";
import { MoveRight } from "lucide-react";

const HERO_EXAMPLES = [
    {
        id: "hero1",
        title: "Hero 1: Holographic Grid",
        description: "The original concept featuring a static WebGL grid floor, particle effects, and floating glass UI blocks.",
        path: "/visual-lab/hero1",
        color: "from-blue-500/20 to-indigo-500/0",
        border: "group-hover:border-blue-500/50"
    },
    {
        id: "hero2",
        title: "Hero 2: Morphing Shapes",
        description: "An interactive layout with dynamic 3D geometry that seamlessly morphs and scales based on the selected tool tab.",
        path: "/visual-lab/hero2",
        color: "from-purple-500/20 to-pink-500/0",
        border: "group-hover:border-purple-500/50"
    },
    {
        id: "hero3",
        title: "Hero 3: Network Nodes",
        description: "A specialized visualization focusing on splines, floating agent nodes, and connection orchestration.",
        path: "/visual-lab/hero3",
        color: "from-emerald-500/20 to-teal-500/0",
        border: "group-hover:border-emerald-500/50",
        badge: "New Concept"
    }
];

export default function HeroIndexPage() {
    return (
        <main className="min-h-screen bg-[#030303] text-white selection:bg-white/30 selection:text-white pt-24 pb-12">
            <div className="max-w-6xl mx-auto w-full px-6">

                {/* Header */}
                <div className="mb-16 space-y-4">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 backdrop-blur-sm">
                        <span className="text-white/50 text-[11px] uppercase font-medium tracking-widest">Visual Lab</span>
                    </div>
                    <h1
                        className="text-4xl md:text-5xl font-light tracking-tight"
                        style={{ fontFamily: "var(--font-fraunces), Georgia, serif" }}
                    >
                        <span className="italic">Hero Section</span> Concepts
                    </h1>
                    <p className="text-white/50 text-lg max-w-2xl font-light">
                        A collection of experimental 3D hero sections for the Orchestrate landing page. Select a concept below to interact with it.
                    </p>
                </div>

                {/* Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {HERO_EXAMPLES.map((hero) => (
                        <Link
                            key={hero.id}
                            href={hero.path}
                            className={`group relative p-8 rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden transition-all duration-500 hover:-translate-y-1 ${hero.border}`}
                        >
                            {/* Hover Gradient */}
                            <div className={`absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-500 ${hero.color}`} />

                            <div className="relative z-10 flex flex-col h-full">
                                {hero.badge && (
                                    <span className="absolute top-0 right-0 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium tracking-wider uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                        {hero.badge}
                                    </span>
                                )}

                                <h2 className="text-xl font-medium text-white/90 mb-3 group-hover:text-white transition-colors">
                                    {hero.title}
                                </h2>

                                <p className="text-white/40 text-sm leading-relaxed mb-8 flex-grow">
                                    {hero.description}
                                </p>

                                <div className="mt-auto flex items-center text-sm font-medium text-white/30 group-hover:text-white/80 transition-colors">
                                    View Prototype
                                    <MoveRight className="w-4 h-4 ml-2 overflow-hidden -translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-300" />
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>

            </div>
        </main>
    );
}
