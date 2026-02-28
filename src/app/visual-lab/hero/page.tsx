'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Logo } from '@/components/brand/Logo';
import { ArrowRight } from 'lucide-react';

/*
  CHOREOGRAPHY:
  
  ROUND 1:
    agent#1 → "One "       (line 1)
    agent#2 → "Zero "      (line 3)
    agent#3 → "codebase."  (line 1)

  [pause 300ms]

  ROUND 2:
    agent#1 → "Many "      (line 2)
    agent#2 → "agents."    (line 2)
    agent#3 → "collisions." (line 3)
*/

const LINES = [
    'One codebase.',     // line index 0
    'Many agents.',      // line index 1
    'Zero collisions.',  // line index 2
];

const LINE_BOLD = [false, false, true];

const AGENTS = [
    { label: 'agent#1', color: '#6366F1' },
    { label: 'agent#2', color: '#10B981' },
    { label: 'agent#3', color: '#F43F5E' },
];

// Rounds: each round is an array of tasks that all execute simultaneously
// Round ends when ALL tasks in it are complete, then pause, then next round
type Task = { agentIdx: number; lineIdx: number; start: number; end: number; delay?: number };

const ROUNDS: { tasks: Task[]; pauseAfter: number }[] = [
    {
        tasks: [
            { agentIdx: 0, lineIdx: 0, start: 0, end: 4 },   // agent#1 → "One "
            { agentIdx: 1, lineIdx: 2, start: 0, end: 5 },   // agent#2 → "Zero "
            { agentIdx: 2, lineIdx: 0, start: 4, end: 13 },  // agent#3 → "codebase."
        ],
        pauseAfter: 300,
    },
    {
        tasks: [
            { agentIdx: 0, lineIdx: 1, start: 0, end: 5 },   // agent#1 → "Many "
            { agentIdx: 1, lineIdx: 1, start: 5, end: 12 },  // agent#2 → "agents."
            { agentIdx: 2, lineIdx: 2, start: 5, end: 17, delay: 3 },  // agent#3 → "collisions." (starts 3 ticks late)
        ],
        pauseAfter: 0,
    },
];

export default function HeroLabPage() {
    const [roundIdx, setRoundIdx] = useState(-1); // -1 = not started
    const [taskProgress, setTaskProgress] = useState<number[]>([]); // chars typed per task in current round
    const [started, setStarted] = useState(false);
    const [done, setDone] = useState(false);

    // Track all permanently revealed chars: [lineIdx][charIdx]
    const [permanentRevealed, setPermanentRevealed] = useState<boolean[][]>(
        () => LINES.map(l => new Array(l.length).fill(false))
    );

    // Start after initial delay
    useEffect(() => {
        const timer = setTimeout(() => {
            setStarted(true);
            setRoundIdx(0);
            setTaskProgress(new Array(ROUNDS[0].tasks.length).fill(0));
        }, 400);
        return () => clearTimeout(timer);
    }, []);

    // Main typing loop for current round
    useEffect(() => {
        if (roundIdx < 0 || roundIdx >= ROUNDS.length) return;

        const round = ROUNDS[roundIdx];
        let tick = 0;
        const interval = setInterval(() => {
            tick++;
            setTaskProgress(prev => {
                const next = prev.map((p, ti) => {
                    const task = round.tasks[ti];
                    const taskDelay = task.delay || 0;
                    if (tick <= taskDelay) return p; // still waiting
                    const taskLen = task.end - task.start;
                    return Math.min(p + 1, taskLen);
                });

                // Check if all tasks in this round are done
                const allDone = next.every((p, ti) => {
                    const task = round.tasks[ti];
                    return p >= task.end - task.start;
                });

                if (allDone) {
                    clearInterval(interval);

                    // Lock in revealed chars
                    setPermanentRevealed(prev => {
                        const copy = prev.map(row => [...row]);
                        round.tasks.forEach(task => {
                            for (let c = task.start; c < task.end; c++) {
                                copy[task.lineIdx][c] = true;
                            }
                        });
                        return copy;
                    });

                    // Move to next round or finish
                    const nextRound = roundIdx + 1;
                    if (nextRound < ROUNDS.length) {
                        setTimeout(() => {
                            setRoundIdx(nextRound);
                            setTaskProgress(new Array(ROUNDS[nextRound].tasks.length).fill(0));
                        }, round.pauseAfter);
                    } else {
                        setTimeout(() => setDone(true), 600);
                    }
                }

                return next;
            });
        }, 160);

        return () => clearInterval(interval);
    }, [roundIdx]);

    // Build revealed + cursor maps for rendering
    const revealed: boolean[][] = permanentRevealed.map(row => [...row]);
    const cursorMap: (number | null)[][] = LINES.map(l => new Array(l.length).fill(null));

    if (roundIdx >= 0 && roundIdx < ROUNDS.length) {
        const round = ROUNDS[roundIdx];
        round.tasks.forEach((task, ti) => {
            const progress = taskProgress[ti] || 0;
            // Reveal typed chars
            for (let c = task.start; c < task.start + progress; c++) {
                revealed[task.lineIdx][c] = true;
            }
            // Place cursor
            const cursorPos = task.start + progress;
            if (cursorPos < task.end) {
                cursorMap[task.lineIdx][cursorPos] = task.agentIdx;
            }
        });
    }

    return (
        <main className="min-h-screen bg-[#050505] text-[#F8FAFC] font-sans selection:bg-white/10 overflow-x-hidden">

            {/* NAVBAR */}
            <nav className="relative z-50 flex items-center justify-between px-6 py-4 md:px-12 max-w-[1400px] mx-auto">
                <div className="flex items-center gap-8">
                    <Link href="/visual-lab" className="hover:opacity-80 transition-opacity">
                        <Logo size="sm" withText={true} />
                    </Link>
                    <div className="hidden md:flex items-center gap-6 text-sm text-white/50">
                        <Link href="#" className="hover:text-white transition-colors">Docs</Link>
                        <Link href="#" className="hover:text-white transition-colors">Pricing</Link>
                        <Link href="#" className="hover:text-white transition-colors">GitHub</Link>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <Link href="#" className="hidden md:block text-sm text-white/50 hover:text-white transition-colors">Sign in</Link>
                    <button className="bg-white text-black hover:bg-white/90 transition-colors px-4 py-2 rounded-md text-sm font-semibold">
                        Get Started
                    </button>
                </div>
            </nav>

            {/* HERO */}
            <section className="relative z-10 flex flex-col items-center justify-center text-center min-h-[calc(100vh-72px)] px-6 md:px-12 -mt-8">
                <div className="max-w-4xl space-y-8">

                    <h1 className="text-[clamp(3rem,8vw,6.5rem)] tracking-tighter leading-[1.05]">
                        {LINES.map((line, li) => (
                            <span key={li} className={`block ${LINE_BOLD[li] ? 'font-semibold' : 'font-extralight'}`}>
                                {line.split('').map((char, ci) => {
                                    const isRevealed = revealed[li][ci];
                                    const agentIdx = cursorMap[li][ci];

                                    return (
                                        <span key={ci} className="relative inline-block">
                                            <span style={{ opacity: isRevealed ? 1 : 0.06 }}>
                                                {char === ' ' ? '\u00A0' : char}
                                            </span>

                                            {agentIdx !== null && !done && (
                                                <>
                                                    {/* Cursor bar */}
                                                    <span
                                                        className="absolute top-[5%] right-[-2px] w-[3px] rounded-sm"
                                                        style={{
                                                            height: '95%',
                                                            backgroundColor: AGENTS[agentIdx].color,
                                                            boxShadow: `0 0 10px ${AGENTS[agentIdx].color}`,
                                                        }}
                                                    />
                                                    {/* Label */}
                                                    <span
                                                        className="absolute top-[105%] right-[-2px] translate-x-[50%] whitespace-nowrap font-sans text-[10px] font-medium tracking-normal px-2 py-1 rounded-md pointer-events-none"
                                                        style={{
                                                            color: AGENTS[agentIdx].color,
                                                            backgroundColor: `${AGENTS[agentIdx].color}20`,
                                                            border: `1px solid ${AGENTS[agentIdx].color}40`,
                                                        }}
                                                    >
                                                        {AGENTS[agentIdx].label}
                                                    </span>
                                                </>
                                            )}
                                        </span>
                                    );
                                })}
                            </span>
                        ))}
                    </h1>

                    <p
                        className="text-base md:text-lg text-white/35 font-light leading-relaxed max-w-lg mx-auto transition-all duration-700"
                        style={{ opacity: done ? 1 : 0, transform: done ? 'translateY(0)' : 'translateY(8px)' }}
                    >
                        Orkestrate connects your AI coding agents — Cursor, Claude, Codex, OpenCode — to a shared coordination layer via MCP. They see each other's plans, avoid conflicts, and collaborate autonomously.
                    </p>

                    <div
                        className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4 transition-all duration-700 delay-200"
                        style={{ opacity: done ? 1 : 0, transform: done ? 'translateY(0)' : 'translateY(8px)' }}
                    >
                        <button className="bg-white text-black hover:bg-white/90 transition-colors px-5 py-3 rounded-lg text-sm font-bold flex items-center gap-2 group">
                            Start Free
                            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                        </button>
                        <div className="flex items-center gap-3 px-4 py-3 bg-white/5 border border-white/10 rounded-lg font-mono text-sm text-white/40 cursor-copy hover:border-white/20 hover:text-white/60 transition-all">
                            <span className="opacity-40">$</span>
                            npx orkestrate init
                        </div>
                    </div>
                </div>
            </section>

            {/* ═══ LABEL VARIATIONS ═══ */}
            <section className="relative z-10 py-20 px-6 md:px-12 border-t border-white/5">
                <div className="max-w-[1000px] mx-auto">
                    <h2 className="font-mono text-[10px] uppercase tracking-[0.4em] text-white/20 mb-12 text-center">
                        Label Style Variations
                    </h2>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-12">
                        {/* Variation 1: Minimal Dot + Text */}
                        <div className="space-y-4">
                            <span className="text-[10px] font-mono text-white/20 uppercase tracking-wider">1. Dot + Text</span>
                            <div className="relative h-20 flex items-center justify-center">
                                <span className="text-4xl font-extralight tracking-tighter">cod</span>
                                <span className="relative text-4xl font-extralight tracking-tighter" style={{ opacity: 0.06 }}>e
                                    <span className="absolute top-[5%] right-[-2px] w-[3px] rounded-sm" style={{ height: '95%', backgroundColor: '#F43F5E', boxShadow: '0 0 10px #F43F5E' }} />
                                    <span className="absolute top-[110%] right-[-2px] translate-x-[50%] flex items-center gap-1.5 whitespace-nowrap">
                                        <span className="w-[6px] h-[6px] rounded-full" style={{ backgroundColor: '#F43F5E' }} />
                                        <span className="text-[10px] font-light tracking-normal" style={{ color: '#F43F5E' }}>agent#3</span>
                                    </span>
                                </span>
                            </div>
                        </div>

                        {/* Variation 2: Pill Badge */}
                        <div className="space-y-4">
                            <span className="text-[10px] font-mono text-white/20 uppercase tracking-wider">2. Pill Badge</span>
                            <div className="relative h-20 flex items-center justify-center">
                                <span className="text-4xl font-extralight tracking-tighter">cod</span>
                                <span className="relative text-4xl font-extralight tracking-tighter" style={{ opacity: 0.06 }}>e
                                    <span className="absolute top-[5%] right-[-2px] w-[3px] rounded-sm" style={{ height: '95%', backgroundColor: '#F43F5E', boxShadow: '0 0 10px #F43F5E' }} />
                                    <span className="absolute top-[110%] right-[-2px] translate-x-[50%] whitespace-nowrap text-[9px] font-semibold tracking-normal px-2.5 py-1 rounded-full" style={{ color: '#F43F5E', backgroundColor: '#F43F5E18', border: '1px solid #F43F5E30' }}>
                                        agent#3
                                    </span>
                                </span>
                            </div>
                        </div>

                        {/* Variation 3: Ghost Text Only */}
                        <div className="space-y-4">
                            <span className="text-[10px] font-mono text-white/20 uppercase tracking-wider">3. Ghost Text</span>
                            <div className="relative h-20 flex items-center justify-center">
                                <span className="text-4xl font-extralight tracking-tighter">cod</span>
                                <span className="relative text-4xl font-extralight tracking-tighter" style={{ opacity: 0.06 }}>e
                                    <span className="absolute top-[5%] right-[-2px] w-[3px] rounded-sm" style={{ height: '95%', backgroundColor: '#F43F5E', boxShadow: '0 0 10px #F43F5E' }} />
                                    <span className="absolute top-[110%] right-[-2px] translate-x-[50%] whitespace-nowrap text-[11px] font-light italic tracking-normal" style={{ color: '#F43F5E', opacity: 0.7 }}>
                                        agent#3
                                    </span>
                                </span>
                            </div>
                        </div>

                        {/* Variation 4: Underline Tag */}
                        <div className="space-y-4">
                            <span className="text-[10px] font-mono text-white/20 uppercase tracking-wider">4. Underline Tag</span>
                            <div className="relative h-20 flex items-center justify-center">
                                <span className="text-4xl font-extralight tracking-tighter">cod</span>
                                <span className="relative text-4xl font-extralight tracking-tighter" style={{ opacity: 0.06 }}>e
                                    <span className="absolute top-[5%] right-[-2px] w-[3px] rounded-sm" style={{ height: '95%', backgroundColor: '#F43F5E', boxShadow: '0 0 10px #F43F5E' }} />
                                    <span className="absolute top-[105%] right-[-2px] translate-x-[50%] whitespace-nowrap flex flex-col items-center gap-0.5">
                                        <span className="w-[1px] h-[8px]" style={{ backgroundColor: '#F43F5E40' }} />
                                        <span className="text-[9px] font-mono font-medium tracking-normal" style={{ color: '#F43F5E' }}>
                                            #3
                                        </span>
                                    </span>
                                </span>
                            </div>
                        </div>

                        {/* Variation 5: Circle Number */}
                        <div className="space-y-4">
                            <span className="text-[10px] font-mono text-white/20 uppercase tracking-wider">5. Circle</span>
                            <div className="relative h-20 flex items-center justify-center">
                                <span className="text-4xl font-extralight tracking-tighter">cod</span>
                                <span className="relative text-4xl font-extralight tracking-tighter" style={{ opacity: 0.06 }}>e
                                    <span className="absolute top-[5%] right-[-2px] w-[3px] rounded-sm" style={{ height: '95%', backgroundColor: '#F43F5E', boxShadow: '0 0 10px #F43F5E' }} />
                                    <span className="absolute top-[110%] right-[-2px] translate-x-[50%] w-[20px] h-[20px] rounded-full flex items-center justify-center text-[9px] font-bold tracking-normal" style={{ color: '#fff', backgroundColor: '#F43F5E' }}>
                                        3
                                    </span>
                                </span>
                            </div>
                        </div>

                        {/* Variation 6: Bracket Style */}
                        <div className="space-y-4">
                            <span className="text-[10px] font-mono text-white/20 uppercase tracking-wider">6. Bracket</span>
                            <div className="relative h-20 flex items-center justify-center">
                                <span className="text-4xl font-extralight tracking-tighter">cod</span>
                                <span className="relative text-4xl font-extralight tracking-tighter" style={{ opacity: 0.06 }}>e
                                    <span className="absolute top-[5%] right-[-2px] w-[3px] rounded-sm" style={{ height: '95%', backgroundColor: '#F43F5E', boxShadow: '0 0 10px #F43F5E' }} />
                                    <span className="absolute top-[110%] right-[-2px] translate-x-[50%] whitespace-nowrap text-[10px] font-mono tracking-normal" style={{ color: '#F43F5E80' }}>
                                        {'['}
                                        <span style={{ color: '#F43F5E' }}>3</span>
                                        {']'}
                                    </span>
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </main>
    );
}
