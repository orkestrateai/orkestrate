import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Orkestrate — Whitepaper",
  description:
    "How Orkestrate coordinates parallel AI coding agents without merge conflicts. Protocol design, failure model, and architecture.",
};

/* ─── Data ─── */

const principles = [
  {
    title: "Intent is explicit",
    body: "Before an agent edits a single file, it writes its objective, claimed paths, and plan to the shared coordination state. Other agents read that state to scope their own work. This isn't a best-practice recommendation — it's the mechanism that prevents two agents from silently rewriting the same module.",
  },
  {
    title: "Observation is independent",
    body: "Hooks and telemetry capture what actually happened — file edits, tool calls, commits — without relying on agents to self-report. The system doesn't trust intent. It verifies behavior. When an agent edits a file it didn't claim, the system catches it and flags the overlap.",
  },
  {
    title: "Git is durable truth",
    body: "Orkestrate doesn't replace version control. It sits alongside it. Agents work on per-agent branches (orkestrate/<agent-id>/<slug>) and share durable code via fetch, rebase, and pull requests. Orkestrate is the coordination layer that tells agents what to work on. Git is where the actual code lives.",
  },
  {
    title: "Conflicts are routed, not blocked",
    body: "When two agents touch overlapping paths, the system emits a conflict_alert with the file, both agents, and what changed. It doesn't lock files. It doesn't roll back writes. It makes the collision visible and gives agents the context they need to resolve it. Throughput stays high. Collisions stay recoverable.",
  },
];

const loopPhases = [
  {
    name: "Read",
    fn: "read_agent_state",
    what: "Pull the current team state — every agent's objective, claimed paths, in-progress plan, recent file edits, and any active collision warnings. The response includes a stateHash that you'll need for the next write.",
  },
  {
    name: "Claim",
    fn: "write_agent_state",
    what: "Declare your intent. Pick the smallest unclaimed path scope that covers what you need to do. Write your objective, plan, and claimed paths. Pass the stateHash you got from reading — if someone else wrote state between your read and your write, the system rejects and you re-read.",
  },
  {
    name: "Execute",
    fn: null,
    what: "Do one focused unit of work. Telemetry hooks fire automatically — file_edit_observed when you edit, commit_observed when you commit. You don't need to report these. The system watches.",
  },
  {
    name: "Persist",
    fn: "write_knowledge_base",
    what: "Record architecture decisions, design rationale, or anything that future agents in this workspace should know. This context outlives your session.",
  },
  {
    name: "Update",
    fn: "write_agent_state",
    what: "Mark completed items, adjust your plan, and narrow your path claims. If you're done, set status to idle. If you're blocked, say so. Then loop back to Read.",
  },
];

const failureModes = [
  {
    case: "Stale state write",
    signal: "expectedStateHash doesn't match",
    policy: "Rejected. Re-read state, merge your intent with whatever changed, retry with the fresh hash.",
    owner: "state handler",
  },
  {
    case: "Cross-repo drift",
    signal: "canonicalRemote mismatch",
    policy: "Rejected. The agent is pointing at the wrong repository. State write blocked until the workspace binding matches.",
    owner: "repo identity",
  },
  {
    case: "Parallel path overlap",
    signal: "file_edit_observed intersects a foreign claim",
    policy: "Both writes are preserved. A conflict_alert is emitted with the overlapping path, both agents, and the edit details. Nothing is dropped.",
    owner: "activity reconciler",
  },
  {
    case: "Agent liveness ambiguity",
    signal: "Stale heartbeat vs. late disconnect event",
    policy: "Agent stays online until a disconnect event newer than its last heartbeat arrives. Prevents premature cleanup.",
    owner: "presence model",
  },
  {
    case: "Duplicate sessions",
    signal: "Same external session ID from multiple streams",
    policy: "Merge attempt — adopt the heuristic session into the canonical one. Dedup by external ID within workspace scope.",
    owner: "session resolver",
  },
  {
    case: "Out-of-order telemetry",
    signal: "Late-arriving events with older timestamps",
    policy: "Store everything immutably. Sort by createdAt at read time. Late events are never discarded.",
    owner: "telemetry ingest",
  },
];

/* ─── Page ─── */

export default function WhitepaperPage() {
  return (
    <main className="min-h-screen bg-[#111214] text-[#F2F2F2] font-sans selection:bg-white/10 overflow-x-hidden">
      {/* Grid bg */}
      <div
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px)",
          backgroundSize: "4rem 4rem",
          maskImage: "radial-gradient(circle at 50% 0%, black, transparent 70%)",
          WebkitMaskImage: "radial-gradient(circle at 50% 0%, black, transparent 70%)",
        }}
      />

      {/* Nav */}
      <nav className="relative z-50 flex items-center justify-between px-6 py-4 md:px-12 max-w-[1400px] mx-auto">
        <div className="flex items-center gap-8">
          <Link href="/" className="hover:opacity-80 transition-opacity">
            <Logo size="sm" withText={true} />
          </Link>
          <div className="hidden md:flex items-center gap-6 text-sm text-white/50">
            <Link href="/docs" className="hover:text-white transition-colors">Docs</Link>
            <Link href="/whitepaper" className="text-white font-medium">Whitepaper</Link>
          </div>
        </div>
        <Link href="/dashboard" className="text-sm text-white/60 hover:text-white transition-colors">
          Dashboard
        </Link>
      </nav>

      {/* Back */}
      <div className="relative z-10 max-w-4xl mx-auto px-6 md:px-12 pt-4">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-white/30 hover:text-white/60 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" />
          Home
        </Link>
      </div>

      {/* HERO */}
      <header className="relative z-10 max-w-4xl mx-auto px-6 md:px-12 pt-12 pb-16 wp-reveal" style={{ animationDelay: "0ms" }}>
        <div className="flex items-center gap-3 mb-6">
          <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-white/40 font-medium">
            Technical Whitepaper
          </span>
          <span className="text-[11px] text-white/20">v0.7 · March 2026</span>
        </div>
        <h1 className="text-[clamp(2rem,5vw,3.5rem)] tracking-tighter leading-[1.1] font-semibold">
          Multi-Agent Code Orchestration{" "}
          <span className="text-white/40 font-extralight">Under Parallel Execution</span>
        </h1>
        <p className="mt-6 max-w-2xl text-base md:text-lg text-white/35 leading-relaxed font-light">
          When multiple AI agents edit the same codebase at the same time, you get a distributed
          systems problem — non-deterministic timing, partial visibility, and shared mutable state.
          This document describes how Orkestrate solves it: the coordination protocol, the failure
          model, and the control loop that keeps agents productive without stepping on each other.
        </p>
      </header>

      <div className="relative z-10 max-w-4xl mx-auto px-6 md:px-12">
        <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>

      {/* TOC */}
      <section className="relative z-10 max-w-4xl mx-auto px-6 md:px-12 py-12 wp-reveal" style={{ animationDelay: "80ms" }}>
        <h2 className="text-[11px] uppercase tracking-[0.14em] text-white/30 font-medium mb-4">Contents</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {["Principles", "The Loop", "Hooks vs State", "Failure Modes"].map((s, i) => (
            <a key={s} href={`#section-${i}`} className="px-4 py-3 rounded-lg border border-white/[0.06] bg-white/[0.02] text-sm text-white/50 hover:text-white hover:border-white/10 hover:bg-white/[0.04] transition-all">
              <span className="text-[10px] text-white/20 block mb-0.5">{String(i + 1).padStart(2, "0")}</span>
              {s}
            </a>
          ))}
        </div>
      </section>

      {/* §1 — PRINCIPLES */}
      <section id="section-0" className="relative z-10 max-w-4xl mx-auto px-6 md:px-12 py-12 wp-reveal" style={{ animationDelay: "160ms" }}>
        <h2 className="text-2xl md:text-3xl font-semibold tracking-tight mb-2">Principles</h2>
        <p className="text-sm text-white/30 mb-8 max-w-2xl">
          Four constraints that everything else is built on.
        </p>
        <div className="space-y-6">
          {principles.map((p) => (
            <article key={p.title} className="group">
              <h3 className="text-[15px] font-medium text-white/70 mb-1.5">{p.title}</h3>
              <p className="text-[13px] leading-[1.7] text-white/30 max-w-3xl">{p.body}</p>
            </article>
          ))}
        </div>
      </section>

      <div className="relative z-10 max-w-4xl mx-auto px-6 md:px-12">
        <div className="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
      </div>

      {/* §2 — THE LOOP */}
      <section id="section-1" className="relative z-10 max-w-4xl mx-auto px-6 md:px-12 py-12 wp-reveal" style={{ animationDelay: "240ms" }}>
        <h2 className="text-2xl md:text-3xl font-semibold tracking-tight mb-2">The Loop</h2>
        <p className="text-sm text-white/30 mb-8 max-w-2xl">
          Every agent runs this cycle. It's designed to be boring — read, claim, work, update, repeat.
          If an agent crashes mid-cycle, the last state write is still valid.
          There's nothing to roll back.
        </p>
        <div className="space-y-px rounded-xl overflow-hidden border border-white/[0.06]">
          {loopPhases.map((phase, i) => (
            <div key={phase.name} className="flex gap-5 p-5 bg-white/[0.015] hover:bg-white/[0.03] transition-colors">
              <div className="shrink-0 pt-0.5">
                <span className="text-[13px] font-medium text-white/50">{phase.name}</span>
              </div>
              <div className="min-w-0 flex-1">
                {phase.fn && (
                  <span className="inline-block text-[11px] font-sans text-white/20 bg-white/[0.04] rounded px-1.5 py-0.5 mb-1.5">{phase.fn}</span>
                )}
                <p className="text-[13px] text-white/30 leading-[1.7]">{phase.what}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="relative z-10 max-w-4xl mx-auto px-6 md:px-12">
        <div className="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
      </div>

      {/* §3 — HOOKS VS STATE */}
      <section id="section-2" className="relative z-10 max-w-4xl mx-auto px-6 md:px-12 py-12 wp-reveal" style={{ animationDelay: "320ms" }}>
        <h2 className="text-2xl md:text-3xl font-semibold tracking-tight mb-2">Hooks vs State Writes</h2>
        <p className="text-sm text-white/30 mb-8 max-w-2xl">
          The most important boundary in the system. Observation and intention are separate pipelines
          that never cross.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-[#10B981]" />
              <h3 className="text-sm font-semibold text-white/70">Hooks & Plugins</h3>
              <span className="text-[10px] text-white/20 ml-auto font-sans">passive</span>
            </div>
            <p className="text-[13px] text-white/35 leading-relaxed mb-3">
              Fire automatically. They capture what happened — not what was planned.
            </p>
            <div className="space-y-1.5 text-[12px] text-white/25">
              <div className="flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-white/15" />Session lifecycle — connect, disconnect, heartbeat</div>
              <div className="flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-white/15" />File edits — path, operation, line range</div>
              <div className="flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-white/15" />Git commits — sha, message, changed files</div>
              <div className="flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-white/15" />Tool calls — name, input, output</div>
            </div>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-[#6366F1]" />
              <h3 className="text-sm font-semibold text-white/70">MCP State Tools</h3>
              <span className="text-[10px] text-white/20 ml-auto font-sans">active</span>
            </div>
            <p className="text-[13px] text-white/35 leading-relaxed mb-3">
              Require the agent to explicitly call them. They represent declared intent.
            </p>
            <div className="space-y-1.5 text-[12px] text-white/25">
              <div className="flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-white/15" />Objective — what the agent is trying to accomplish</div>
              <div className="flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-white/15" />Claimed paths — files it intends to edit</div>
              <div className="flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-white/15" />Plan — ordered list of steps</div>
              <div className="flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-white/15" />Completed items — what's done</div>
            </div>
          </div>
        </div>
      </section>

      <div className="relative z-10 max-w-4xl mx-auto px-6 md:px-12">
        <div className="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
      </div>

      {/* §4 — FAILURE MODES */}
      <section id="section-3" className="relative z-10 max-w-4xl mx-auto px-6 md:px-12 py-12 wp-reveal" style={{ animationDelay: "400ms" }}>
        <h2 className="text-2xl md:text-3xl font-semibold tracking-tight mb-2">Failure Modes</h2>
        <p className="text-sm text-white/30 mb-8 max-w-2xl">
          Every race condition and edge case has a deterministic response.
          The system doesn't guess. It rejects or preserves.
        </p>
        <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
          <table className="w-full min-w-[700px] text-left">
            <thead>
              <tr className="border-b border-white/[0.06] text-[11px] uppercase tracking-[0.12em] text-white/25">
                <th className="px-5 py-3 font-medium">Case</th>
                <th className="px-5 py-3 font-medium">Signal</th>
                <th className="px-5 py-3 font-medium">Response</th>
                <th className="px-5 py-3 font-medium">Owner</th>
              </tr>
            </thead>
            <tbody>
              {failureModes.map((f) => (
                <tr key={f.case} className="border-b border-white/[0.04] last:border-b-0 hover:bg-white/[0.015] transition-colors">
                  <td className="px-5 py-4 text-[13px] font-medium text-white/60 whitespace-nowrap">{f.case}</td>
                  <td className="px-5 py-4 text-[13px] text-white/25">{f.signal}</td>
                  <td className="px-5 py-4 text-[13px] text-white/35 leading-relaxed">{f.policy}</td>
                  <td className="px-5 py-4 text-[11px] text-white/20 whitespace-nowrap">{f.owner}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* DESIGN POSITION */}
      <section className="relative z-10 max-w-4xl mx-auto px-6 md:px-12 py-12 wp-reveal" style={{ animationDelay: "480ms" }}>
        <h2 className="text-2xl md:text-3xl font-semibold tracking-tight mb-4">Design Position</h2>
        <div className="space-y-4 text-[14px] text-white/35 leading-[1.8] max-w-3xl">
          <p>
            Orkestrate biases for <span className="text-white/60">explicit contracts over hidden automation</span>.
            The initialize tool frames behavior. Read/write state is the coordination primitive.
            Git stays as durable truth. Telemetry stays as ground-truth observation.
          </p>
          <p>
            You can understand what any agent is doing by reading its last state write.
            You don't need to trace telemetry or infer intent from diffs.
            That's the point — the system is <span className="text-white/60">legible at the coordination layer</span>,
            even with dozens of agents running concurrently.
          </p>
          <p>
            The system doesn't try to prevent all conflicts. It makes them
            <span className="text-white/60"> visible, attributable, and recoverable</span>.
            That's a deliberate trade — maximum throughput, minimum surprise.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 max-w-4xl mx-auto px-6 md:px-12 py-8 border-t border-white/[0.06]">
        <div className="flex items-center justify-between text-[12px] text-white/20">
          <span>Orkestrate · 2026</span>
          <div className="flex items-center gap-4">
            <Link href="/docs" className="hover:text-white/40 transition-colors">Docs</Link>
            <Link href="/dashboard" className="hover:text-white/40 transition-colors">Dashboard</Link>
          </div>
        </div>
      </footer>

      <style>{`
        .wp-reveal {
          opacity: 0;
          transform: translateY(16px);
          animation: wpReveal 600ms cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
        }
        @keyframes wpReveal {
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </main>
  );
}
