'use client';

import React, { useState, useEffect } from 'react';
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
    agent#3 → "collisions." (line 3, delay: 3)
*/

const LINES = [
    'One codebase.',
    'Many agents.',
    'Zero collisions.',
];

const LINE_BOLD = [false, false, true];

const AGENTS = [
    { label: '1', color: '#6366F1' },
    { label: '2', color: '#10B981' },
    { label: '3', color: '#F43F5E' },
];

type Task = { agentIdx: number; lineIdx: number; start: number; end: number; delay?: number };

const ROUNDS: { tasks: Task[]; pauseAfter: number }[] = [
    {
        tasks: [
            { agentIdx: 0, lineIdx: 0, start: 0, end: 4 },
            { agentIdx: 1, lineIdx: 2, start: 0, end: 5 },
            { agentIdx: 2, lineIdx: 0, start: 4, end: 13 },
        ],
        pauseAfter: 300,
    },
    {
        tasks: [
            { agentIdx: 0, lineIdx: 1, start: 0, end: 5 },
            { agentIdx: 1, lineIdx: 1, start: 5, end: 12 },
            { agentIdx: 2, lineIdx: 2, start: 5, end: 17, delay: 3 },
        ],
        pauseAfter: 0,
    },
];

export default function VisualLabHome() {
    const [roundIdx, setRoundIdx] = useState(-1);
    const [taskProgress, setTaskProgress] = useState<number[]>([]);
    const [started, setStarted] = useState(false);
    const [done, setDone] = useState(false);

    const [permanentRevealed, setPermanentRevealed] = useState<boolean[][]>(
        () => LINES.map(l => new Array(l.length).fill(false))
    );
    const [flashingLines, setFlashingLines] = useState<number[]>([]);

    useEffect(() => {
        const timer = setTimeout(() => {
            setStarted(true);
            setRoundIdx(0);
            setTaskProgress(new Array(ROUNDS[0].tasks.length).fill(0));
        }, 400);
        return () => clearTimeout(timer);
    }, []);

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
                    if (tick <= taskDelay) return p;
                    const taskLen = task.end - task.start;
                    return Math.min(p + 1, taskLen);
                });

                const allDone = next.every((p, ti) => {
                    const task = round.tasks[ti];
                    return p >= task.end - task.start;
                });

                if (allDone) {
                    clearInterval(interval);

                    const newlyCompletedLines = [...new Set(round.tasks.map(t => t.lineIdx))];
                    setFlashingLines(newlyCompletedLines);
                    setTimeout(() => setFlashingLines([]), 300);

                    setPermanentRevealed(prev => {
                        const copy = prev.map(row => [...row]);
                        round.tasks.forEach(task => {
                            for (let c = task.start; c < task.end; c++) {
                                copy[task.lineIdx][c] = true;
                            }
                        });
                        return copy;
                    });

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
        }, 100);

        return () => clearInterval(interval);
    }, [roundIdx]);

    // Build render maps
    const revealed: boolean[][] = permanentRevealed.map(row => [...row]);
    const cursorMap: (number | null)[][] = LINES.map(l => new Array(l.length).fill(null));

    if (roundIdx >= 0 && roundIdx < ROUNDS.length) {
        const round = ROUNDS[roundIdx];
        round.tasks.forEach((task, ti) => {
            const progress = taskProgress[ti] || 0;
            for (let c = task.start; c < task.start + progress; c++) {
                revealed[task.lineIdx][c] = true;
            }
            const cursorPos = task.start + progress;
            if (cursorPos < task.end) {
                cursorMap[task.lineIdx][cursorPos] = task.agentIdx;
            }
        });
    }

    return (
        <main className="min-h-screen bg-[#050505] text-[#F8FAFC] font-sans selection:bg-white/10 overflow-x-hidden">

            {/* Background Grid */}
            <div className="fixed inset-0 z-0 pointer-events-none"
                style={{
                    backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px)',
                    backgroundSize: '4rem 4rem',
                    maskImage: 'radial-gradient(circle at 50% 0%, black, transparent 80%)',
                    WebkitMaskImage: 'radial-gradient(circle at 50% 0%, black, transparent 80%)'
                }}
            />

            {/* ═══ NAVBAR ═══ */}
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

            {/* ═══ HERO ═══ */}
            <section className="relative z-10 flex flex-col items-center justify-center text-center min-h-[calc(100vh-72px)] px-6 md:px-12 -mt-8">
                <div className="max-w-4xl space-y-8">

                    <h1 className="text-[clamp(3rem,8vw,6.5rem)] tracking-tighter leading-[1.05]">
                        {LINES.map((line, li) => (
                            <span key={li} className={`block ${LINE_BOLD[li] ? 'font-semibold' : 'font-extralight'} ${flashingLines.includes(li) ? 'line-complete-flash' : ''}`}>
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
                                                    {/* Circle label */}
                                                    <span
                                                        className="absolute top-[110%] right-[-2px] translate-x-[50%] w-[20px] h-[20px] rounded-full flex items-center justify-center text-[9px] font-bold tracking-normal pointer-events-none"
                                                        style={{
                                                            color: '#fff',
                                                            backgroundColor: AGENTS[agentIdx].color,
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

        </main>
    );
}
