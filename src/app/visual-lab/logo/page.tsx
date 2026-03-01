'use client';

import React, { useState } from 'react';

const THEMES = [
  { name: 'Indigo', hex: '#6366F1', rgb: '99, 102, 241' },
  { name: 'Emerald', hex: '#10B981', rgb: '16, 185, 129' },
  { name: 'Rose', hex: '#F43F5E', rgb: '244, 63, 94' },
  { name: 'Cyan', hex: '#0EA5E9', rgb: '14, 165, 233' },
  { name: 'Amber', hex: '#F59E0B', rgb: '245, 158, 11' },
  { name: 'Monochrome', hex: '#FFFFFF', rgb: '255, 255, 255' },
];

export default function VisualLabPage() {
  const [theme, setTheme] = useState(THEMES[1]); // Default to Emerald

  return (
    <div
      className="relative min-h-screen bg-[#050505] text-[#F8FAFC] p-8 md:p-12 font-sans selection:bg-white/10"
      style={{
        '--brand-hex': theme.hex,
        '--brand-rgb': theme.rgb,
      } as React.CSSProperties}
    >
      <style dangerouslySetInnerHTML={{
        __html: `
        .text-brand { color: var(--brand-hex); }
        .bg-brand { background-color: var(--brand-hex); }
        .border-brand { border-color: var(--brand-hex); }
        .fill-brand { fill: var(--brand-hex); }
        .stroke-brand { stroke: var(--brand-hex); }
        .shadow-brand { box-shadow: 0 0 8px var(--brand-hex); }
        .bg-brand-5 { background-color: rgba(var(--brand-rgb), 0.05); }
        .bg-brand-10 { background-color: rgba(var(--brand-rgb), 0.1); }
        .bg-brand-20 { background-color: rgba(var(--brand-rgb), 0.2); }
        .bg-brand-30 { background-color: rgba(var(--brand-rgb), 0.3); }
        .border-brand-30 { border-color: rgba(var(--brand-rgb), 0.3); }
        .from-brand-5 { --tw-gradient-from: rgba(var(--brand-rgb), 0.1) var(--tw-gradient-from-position); --tw-gradient-to: rgba(var(--brand-rgb), 0) var(--tw-gradient-to-position); --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to); }
        .via-brand { --tw-gradient-to: rgba(var(--brand-rgb), 0)  var(--tw-gradient-to-position); --tw-gradient-stops: var(--tw-gradient-from), var(--brand-hex) var(--tw-gradient-via-position), var(--tw-gradient-to); }
        
        .group:hover .group-hover\\:text-brand { color: var(--brand-hex); }
        .group:hover .group-hover\\:border-brand { border-color: var(--brand-hex); }
        .group:hover .group-hover\\:stroke-brand { stroke: var(--brand-hex); }
        .group:hover .group-hover\\:fill-brand { fill: var(--brand-hex); }
      `}} />

      {/* Background Grid */}
      <div className="absolute inset-0 z-0 pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px)',
          backgroundSize: '4rem 4rem',
          maskImage: 'radial-gradient(circle at 50% 0%, black, transparent 80%)',
          WebkitMaskImage: 'radial-gradient(circle at 50% 0%, black, transparent 80%)'
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto space-y-16 py-12">

        <header className="space-y-8 pb-12 border-b border-white/10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-brand-30 bg-brand-10 text-brand text-[10px] font-mono uppercase tracking-[0.2em] transition-colors duration-300">
                <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse shadow-brand transition-colors duration-300" />
                Identity Lab / FINAL STAGE
              </div>
              <h2 className="text-6xl md:text-7xl font-serif text-white tracking-tighter">Lineage 13 Refines</h2>
              <p className="text-white/50 text-xl max-w-3xl font-light leading-relaxed">
                Hyper-focusing on <span className="text-white font-medium italic underline decoration-brand/30">Isometric Stacks</span>. The architecture of the "Master Terminal" visualized across 7 final expressions.
              </p>
            </div>

            <div className="flex flex-col gap-4">
              <span className="text-[10px] font-mono text-white/40 uppercase tracking-[0.3em]">Environment Accent</span>
              <div className="flex items-center gap-2 bg-[#0A0A0A] p-2.5 rounded-2xl border border-white/10 shadow-2xl">
                {THEMES.map((t) => (
                  <button
                    key={t.name}
                    onClick={() => setTheme(t)}
                    className={`w-10 h-10 rounded-xl transition-all duration-500 ${theme.name === t.name ? 'scale-110 ring-2 ring-brand ring-offset-4 ring-offset-[#050505]' : 'opacity-30 hover:opacity-100 hover:scale-105'}`}
                    style={{ backgroundColor: t.hex }}
                    title={t.name}
                  />
                ))}
              </div>
            </div>
          </div>
        </header>

        <main className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* 13 / Original */}
          <div className="group relative border border-white/10 bg-[#0A0A0A] p-10 rounded-2xl hover:border-brand/50 transition-all duration-700 overflow-hidden flex flex-col cursor-pointer">
            <div className="absolute inset-0 bg-gradient-to-tr from-brand-5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="h-64 flex items-center justify-center border-b border-white/5 mb-8 relative">
              <div className="flex items-center gap-5">
                <div className="relative w-16 h-16 group-hover:scale-110 transition-transform duration-700">
                  <svg width="60" height="30" viewBox="0 0 48 24" fill="none" className="absolute bottom-0 left-0 opacity-10"><path d="M24 22L2 12L24 2L46 12L24 22Z" className="stroke-brand" strokeWidth="2" /></svg>
                  <svg width="60" height="30" viewBox="0 0 48 24" fill="none" className="absolute bottom-4 left-0 opacity-40"><path d="M24 22L2 12L24 2L46 12L24 22Z" className="stroke-white" strokeWidth="2" /><path d="M24 22L2 12L24 2L46 12L24 22Z" className="fill-brand-10" /></svg>
                  <svg width="60" height="30" viewBox="0 0 48 24" fill="none" className="absolute bottom-8 left-0"><path d="M24 22L2 12L24 2L46 12L24 22Z" className="stroke-brand fill-brand-20" strokeWidth="2" /></svg>
                </div>
                <span className="font-sans text-4xl font-light tracking-tight">Orkestrate</span>
              </div>
            </div>
            <div className="space-y-4 relative">
              <div className="flex justify-between items-center">
                <h3 className="font-mono text-xs text-brand uppercase tracking-[0.2em]">13 / Original Stack</h3>
                <span className="px-2 py-0.5 border border-white/10 rounded text-[9px] font-mono text-white/30">v1.0</span>
              </div>
              <div className="space-y-2">
                <p className="text-xs text-brand/60 uppercase font-bold tracking-widest">Meaning: Foundation</p>
                <p className="text-sm text-white/50 leading-relaxed italic">"The core architecture of the conductor. Structural, professional, and stable."</p>
              </div>
            </div>
          </div>

          {/* 13a / Fanned Stack */}
          <div className="group relative border border-white/10 bg-[#0A0A0A] p-10 rounded-2xl hover:border-brand/50 transition-all duration-700 overflow-hidden flex flex-col cursor-pointer">
            <div className="h-64 flex items-center justify-center border-b border-white/5 mb-8 relative">
              <div className="flex flex-col items-center gap-6">
                <div className="relative w-24 h-20">
                  {[0, 10, 20, 30].map((y, i) => (
                    <svg key={y} width="64" height="32" viewBox="0 0 48 24" fill="none" className="absolute left-1/2 -ml-8 transition-all duration-700 group-hover:-translate-y-2" style={{ bottom: `${y}px`, opacity: 1 - i * 0.22 }}>
                      <path d="M24 22L2 12L24 2L46 12L24 22Z" className={i % 2 === 0 ? "stroke-brand" : "stroke-white"} strokeWidth="2.5" />
                    </svg>
                  ))}
                </div>
                <span className="font-sans text-4xl font-bold tracking-tight">Orkestrate</span>
              </div>
            </div>
            <div className="space-y-4 relative">
              <div className="flex justify-between items-center">
                <h3 className="font-mono text-xs text-brand uppercase tracking-[0.2em]">13a / Fanned Stack</h3>
                <span className="px-2 py-0.5 border border-white/10 rounded text-[9px] font-mono text-white/30">Scale</span>
              </div>
              <div className="space-y-2">
                <p className="text-xs text-brand/60 uppercase font-bold tracking-widest">Meaning: Parallelism</p>
                <p className="text-sm text-white/50 leading-relaxed italic">"Represents the expansive range of handling multiple agents simultaneously."</p>
              </div>
            </div>
          </div>

          {/* 13b / Linked Tiers */}
          <div className="group relative border border-white/10 bg-[#0A0A0A] p-10 rounded-2xl hover:border-brand/50 transition-all duration-700 overflow-hidden flex flex-col cursor-pointer">
            <div className="h-64 flex items-center justify-center border-b border-white/5 mb-8 relative">
              <div className="flex items-center gap-6">
                <div className="relative w-16 h-16">
                  <svg width="64" height="64" viewBox="0 0 48 48" fill="none" className="group-hover:scale-110 transition-transform duration-700">
                    <path d="M24 10L6 18L24 26L42 18L24 10Z" className="stroke-white fill-brand-10" strokeWidth="1.5" />
                    <path d="M24 22L6 30L24 38L42 30L24 22Z" className="stroke-brand fill-brand-20" strokeWidth="1.5" />
                    <line x1="6" y1="18" x2="6" y2="30" className="stroke-brand" strokeWidth="2" />
                    <line x1="42" y1="18" x2="42" y2="30" className="stroke-brand" strokeWidth="2" />
                    <line x1="24" y1="26" x2="24" y2="38" className="stroke-white" strokeWidth="2" />
                  </svg>
                </div>
                <span className="font-sans text-4xl font-medium tracking-tight">Orkestrate</span>
              </div>
            </div>
            <div className="space-y-4 relative">
              <div className="flex justify-between items-center">
                <h3 className="font-mono text-xs text-brand uppercase tracking-[0.2em]">13b / Linked Tiers</h3>
                <span className="px-2 py-0.5 border border-white/10 rounded text-[9px] font-mono text-white/30">Unity</span>
              </div>
              <div className="space-y-2">
                <p className="text-xs text-brand/60 uppercase font-bold tracking-widest">Meaning: Synchronization</p>
                <p className="text-sm text-white/50 leading-relaxed italic">"The connectivity of agent logic. No-collision, seamless talk between nodes."</p>
              </div>
            </div>
          </div>

          {/* 13c / Infinite Loop */}
          <div className="group relative border border-white/10 bg-[#0A0A0A] p-10 rounded-2xl hover:border-brand/50 transition-all duration-700 overflow-hidden flex flex-col cursor-pointer">
            <div className="h-64 flex items-center justify-center border-b border-white/5 mb-8 relative">
              <div className="flex flex-col items-center gap-4">
                <div className="relative w-20 h-20 flex items-center justify-center">
                  <svg width="80" height="80" viewBox="0 0 80 80" className="group-hover:rotate-180 transition-transform duration-[1.2s]">
                    <path d="M40 15 L70 30 L40 45 L10 30 Z" fill="none" className="stroke-brand" strokeWidth="2" />
                    <path d="M40 35 L70 50 L40 65 L10 50 Z" fill="none" className="stroke-white/40" strokeWidth="2" />
                    <path d="M10 30 C 10 30 10 50 10 50" className="stroke-brand" strokeWidth="2" strokeDasharray="2 2" />
                    <path d="M70 30 C 70 30 70 50 70 50" className="stroke-white/40" strokeWidth="2" strokeDasharray="2 2" />
                  </svg>
                  <div className="absolute w-2 h-2 bg-brand rounded-full animate-ping" />
                </div>
                <span className="font-serif text-3xl italic tracking-widest">Orkestrate</span>
              </div>
            </div>
            <div className="space-y-4 relative">
              <div className="flex justify-between items-center">
                <h3 className="font-mono text-xs text-brand uppercase tracking-[0.2em]">13c / Infinite Loop</h3>
                <span className="px-2 py-0.5 border border-white/10 rounded text-[9px] font-mono text-white/30">Uptime</span>
              </div>
              <div className="space-y-2">
                <p className="text-xs text-brand/60 uppercase font-bold tracking-widest">Meaning: Continuity</p>
                <p className="text-sm text-white/50 leading-relaxed italic">"Represents long-running processes and the persistent state of active logic."</p>
              </div>
            </div>
          </div>

          {/* 13d / Data Core */}
          <div className="group relative border border-white/10 bg-[#0A0A0A] p-10 rounded-2xl hover:border-brand/50 transition-all duration-700 overflow-hidden flex flex-col cursor-pointer">
            <div className="h-64 flex items-center justify-center border-b border-white/5 mb-8 relative">
              <div className="flex items-center gap-6">
                <div className="relative w-16 h-20">
                  <div className="absolute inset-x-[45%] top-0 bottom-0 w-[10%] bg-brand opacity-20 group-hover:opacity-100 transition-opacity" />
                  <svg width="60" height="30" viewBox="0 0 48 24" fill="none" className="absolute top-2 left-0"><path d="M24 22L2 12L24 2L46 12L24 22Z" className="stroke-white/30" strokeWidth="2" /></svg>
                  <svg width="60" height="30" viewBox="0 0 48 24" fill="none" className="absolute top-8 left-0"><path d="M24 22L2 12L24 2L46 12L24 22Z" className="stroke-brand" strokeWidth="3" /></svg>
                  <svg width="60" height="30" viewBox="0 0 48 24" fill="none" className="absolute top-14 left-0"><path d="M24 22L2 12L24 2L46 12L24 22Z" className="stroke-white/30" strokeWidth="2" /></svg>
                </div>
                <span className="font-sans text-4xl font-black tracking-tighter uppercase">Orkestrate</span>
              </div>
            </div>
            <div className="space-y-4 relative">
              <div className="flex justify-between items-center">
                <h3 className="font-mono text-xs text-brand uppercase tracking-[0.2em]">13d / Data Core</h3>
                <span className="px-2 py-0.5 border border-white/10 rounded text-[9px] font-mono text-white/30">Nucleus</span>
              </div>
              <div className="space-y-2">
                <p className="text-xs text-brand/60 uppercase font-bold tracking-widest">Meaning: Command</p>
                <p className="text-sm text-white/50 leading-relaxed italic">"The user as the central conductor, with agent orbits tied to a singular intent."</p>
              </div>
            </div>
          </div>

          {/* 13e / Dynamic Pulse */}
          <div className="group relative border border-white/10 bg-[#0A0A0A] p-10 rounded-2xl hover:border-brand/50 transition-all duration-700 overflow-hidden flex flex-col cursor-pointer">
            <div className="h-64 flex items-center justify-center border-b border-white/5 mb-8 relative">
              <div className="flex flex-col items-center gap-4">
                <div className="relative w-24 h-16 grayscale group-hover:grayscale-0 transition-all duration-1000">
                  <svg width="80" height="40" viewBox="0 0 48 24" fill="none" className="absolute top-0 left-0 animate-pulse"><path d="M24 22L2 12L24 2L46 12L24 22Z" className="stroke-brand" strokeWidth="1" /></svg>
                  <svg width="80" height="40" viewBox="0 0 48 24" fill="none" className="absolute top-3 left-0"><path d="M24 22L2 12L24 2L46 12L24 22Z" className="stroke-white" strokeWidth="2" /></svg>
                  <svg width="80" height="40" viewBox="0 0 48 24" fill="none" className="absolute top-6 left-0 animate-pulse delay-75"><path d="M24 22L2 12L24 2L46 12L24 22Z" className="stroke-brand/40" strokeWidth="3" /></svg>
                </div>
                <div className="flex items-center gap-1">
                  <span className="font-mono text-2xl font-bold tracking-tight">ORK</span>
                  <span className="font-mono text-2xl font-light text-white/20">ESTRATE</span>
                </div>
              </div>
            </div>
            <div className="space-y-4 relative">
              <div className="flex justify-between items-center">
                <h3 className="font-mono text-xs text-brand uppercase tracking-[0.2em]">13e / Dynamic Pulse</h3>
                <span className="px-2 py-0.5 border border-white/10 rounded text-[9px] font-mono text-white/30">Live</span>
              </div>
              <div className="space-y-2">
                <p className="text-xs text-brand/60 uppercase font-bold tracking-widest">Meaning: Heartbeat</p>
                <p className="text-sm text-white/50 leading-relaxed italic">"Visualizing the data flowing through the stacks. Always live, always responsive."</p>
              </div>
            </div>
          </div>

          {/* 13f / Hex Core */}
          <div className="group relative border border-white/10 bg-[#0A0A0A] p-10 rounded-2xl hover:border-brand/50 transition-all duration-700 overflow-hidden flex flex-col cursor-pointer md:col-span-2 lg:col-span-1">
            <div className="h-64 flex items-center justify-center border-b border-white/5 mb-8 relative">
              <div className="flex flex-col items-center gap-6">
                <div className="relative group-hover:rotate-90 transition-transform duration-1000">
                  <svg width="100" height="100" viewBox="0 0 100 100">
                    <path d="M50 5 L90 25 L90 75 L50 95 L10 75 L10 25 Z" fill="none" className="stroke-white opacity-20" strokeWidth="1" />
                    <path d="M50 25 L80 40 L80 60 L50 75 L20 60 L20 40 Z" fill="none" className="stroke-brand" strokeWidth="3" />
                    <circle cx="50" cy="50" r="10" className="fill-brand animate-pulse" />
                  </svg>
                </div>
                <span className="font-sans text-4xl font-black uppercase tracking-[0.1em]">Orkestrate</span>
              </div>
            </div>
            <div className="space-y-4 relative">
              <div className="flex justify-between items-center">
                <h3 className="font-mono text-xs text-brand uppercase tracking-[0.2em]">13f / Hex Core</h3>
                <span className="px-2 py-0.5 border border-white/10 rounded text-[9px] font-mono text-white/30">Stable</span>
              </div>
              <div className="space-y-2">
                <p className="text-xs text-brand/60 uppercase font-bold tracking-widest">Meaning: Integrity</p>
                <p className="text-sm text-white/50 leading-relaxed italic">"The strongest geometric profile. Represents a system built to never fail."</p>
              </div>
            </div>
          </div>
        </main>

        <footer className="pt-16 pb-24 text-center border-t border-white/10">
          <p className="text-white/20 font-mono text-[10px] uppercase tracking-[0.5em]">
            Final Selection Pending / Orkestrate 2026
          </p>
        </footer>

      </div>
    </div>
  )
}
