"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Minus, Square, X } from "lucide-react";

// ─── Types & Configuration (From your global types file) ──────────────
export type SimulationStep =
  | "start"
  | "type_join"
  | "exec_join"
  | "kim_work"
  | "type_intent"
  | "exec_intent"
  | "kim_claim"
  | "type_fix"
  | "exec_fix"
  | "sam_sync"
  | "exec_release"
  | "end";

export const STEPS: { id: SimulationStep; duration: number }[] = [
  { id: "start", duration: 800 },
  { id: "type_join", duration: 800 },
  { id: "exec_join", duration: 1500 },
  { id: "kim_work", duration: 2000 },
  { id: "type_intent", duration: 1000 },
  { id: "exec_intent", duration: 2000 },
  { id: "kim_claim", duration: 2000 },
  { id: "type_fix", duration: 1200 },
  { id: "exec_fix", duration: 2500 },
  { id: "sam_sync", duration: 2000 },
  { id: "exec_release", duration: 1500 },
  { id: "end", duration: 2000 },
];

// ─── Shared UI Helpers ──────────────────────────────────────────────────────

const AnimatedText = ({ text, speed = 20 }: { text: string; speed?: number }) => {
  const [displayedText, setDisplayedText] = useState("");

  useEffect(() => {
    let i = 0;
    setDisplayedText("");
    const interval = setInterval(() => {
      setDisplayedText(text.slice(0, i + 1));
      i++;
      if (i >= text.length) clearInterval(interval);
    }, speed);
    return () => clearInterval(interval);
  }, [text, speed]);

  return <span>{displayedText}</span>;
};

const BlinkingCursor = () => (
  <motion.span
    animate={{ opacity: 1 }}
    transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
    className="inline-block w-2 h-3.5 bg-zinc-300 align-middle ml-1"
  />
);

// ─── Codex Specific UI Blocks ───────────────────────────────────────────────

const CodexWarning = ({ text }: { text: string }) => (
  <div className="text-[#E5C07B] text-[11px] leading-relaxed my-2 flex gap-1.5">
    <span>⚠</span>
    <span>{text}</span>
  </div>
);

const CodexReturn = ({ text, isError = false }: { text: string; isError?: boolean }) => (
  <div className={`flex gap-2 pl-4 mt-1 text-[11px] leading-relaxed ${isError ? "text-[#E06C75]" : "text-zinc-400"}`}>
    <span className="text-zinc-500 shrink-0">└</span>
    <span className="whitespace-pre-wrap break-words">{text}</span>
  </div>
);

const CodexAction = ({
  command,
  returns = [],
  delay = 0,
  isError = false
}: {
  command: React.ReactNode;
  returns?: string[];
  delay?: number;
  isError?: boolean;
}) => (
  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: delay / 1000 }} className="my-3">
    <div className="flex gap-2 text-[11px]">
      <span className="text-[#98C379]">●</span>
      <span className="text-zinc-200">{command}</span>
    </div>
    {returns.map((ret, idx) => (
      <motion.div key={idx} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: (delay + 300 + (idx * 200)) / 1000 }}>
        <CodexReturn text={ret} isError={isError && idx === returns.length - 1} />
      </motion.div>
    ))}
  </motion.div>
);

const CodexSeparator = () => (
  <div className="text-zinc-600 text-[10px] tracking-tighter my-4 overflow-hidden whitespace-nowrap opacity-50">
    ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  </div>
);

// ─── Main Component ─────────────────────────────────────────────────────────

export const CodexReplica = ({ stepId }: { stepId: SimulationStep }) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [userQuery, setUserQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [showResponse, setShowResponse] = useState(false);

  // Safe auto-scroll
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const observer = new MutationObserver(() => {
      el.scrollTop = el.scrollHeight;
    });
    observer.observe(el, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, []);

  const stepIdx = STEPS.findIndex(s => s.id === stepId);
  const isPast = (id: SimulationStep) => stepIdx >= STEPS.findIndex(s => s.id === id);
  const isExact = (id: SimulationStep) => stepId === id;

  const showIdleCursor = ["start", "idle_1", "idle_2", "type_intent", "exec_intent", "type_fix", "exec_fix", "exec_release", "end"].includes(stepId);

  return (
    <div className="absolute inset-0 flex flex-col bg-[#141414] border border-white/[0.08] rounded-xl overflow-hidden shadow-2xl text-left font-mono">

      {/* Fake OS Header */}
      <div className="flex shrink-0 items-center px-4 py-2 bg-[#141414] border-b border-white/[0.04] select-none h-10">
        <div className="flex gap-2 items-center">
          <div className="w-3.5 h-3.5 rounded-full bg-zinc-700 flex items-center justify-center text-[8px] font-bold text-black border border-zinc-500">
            _
          </div>
          <span className="text-[10px] text-zinc-400 tracking-wide font-sans">OpenAI Codex</span>
        </div>
        <div className="ml-auto flex gap-4 text-zinc-600">
          <Minus className="w-3 h-3 cursor-pointer hover:text-zinc-400" />
          <Square className="w-2.5 h-2.5 cursor-pointer hover:text-zinc-400" />
          <X className="w-3 h-3 cursor-pointer hover:text-zinc-400" />
        </div>
      </div>

      {/* Main Terminal Stream */}
      <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-y-auto p-4 custom-scrollbar scroll-smooth">

        <div className="max-w-2xl pb-6">

          {/* Codex ASCII Header */}
          <div className="border border-zinc-600/50 rounded-md p-3 inline-block mb-4 bg-white/[0.01]">
            <div className="text-zinc-200 font-bold mb-2.5 text-[11px] tracking-wide">&gt;_ OpenAI Codex (v0.114.0)</div>
            <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[11px] text-zinc-400">
              <span>model:</span>
              <span><span className="text-zinc-200">gpt-5.4 xhigh</span> <span className="text-[#61AFEF] ml-2">/model</span> to change</span>
              <span>directory:</span>
              <span className="text-zinc-200">~\OneDrive\Desktop\2026\Orkestrate</span>
            </div>
          </div>

          <div className="text-zinc-400 text-[11px] mb-4">
            Tip: <span className="italic">Paste an image with Ctrl+V to attach it to your next message.</span>
          </div>

          <CodexWarning text="MCP client for 'qmd' failed to start: MCP startup failed: handshaking with MCP server failed: connection closed" />
          <CodexWarning text="MCP startup incomplete (failed: qmd, supabase)" />

          <CodexSeparator />

          {/* Phase 1: Join Workspace */}
          {isPast("type_join") && (
            <div className="mt-4">
              <div className="flex gap-2 text-zinc-200 text-[11.5px] font-bold mb-3">
                <span className="text-zinc-500">›</span>
                <span className="flex">
                  {isExact("type_join") ? <AnimatedText text="join workspace" /> : "join workspace"}
                  {isExact("type_join") && <BlinkingCursor />}
                </span>
              </div>

              {isPast("exec_join") && (
                <>
                  <CodexAction
                    command={<>I’ve read the team state; next I’m collecting the live git context from this repo and then I’ll run <span className="text-[#61AFEF]">join_workspace</span>.</>}
                    delay={100}
                  />
                  <CodexAction
                    command={<>Ran <span className="text-[#E06C75]">git</span> rev-parse HEAD; <span className="text-[#E06C75]">git</span> remote get-url origin...</>}
                    returns={[
                      "main\n2fa38f3142ba77caab3b7579f5ebdf2d742f7529\n... +69 lines",
                      "error: No such remote 'origin'"
                    ]}
                    delay={600}
                  />
                  <CodexAction
                    command={<>Called <span className="text-[#61AFEF]">Orkestrate.join_workspace</span></>}
                    returns={[
                      "Joined workspace ws_beb56d930a32 as Orkestrate CLI-0113df5fb8.",
                      "Workflow phase=none. Next required tool: identify_intent. Reason: Session is verified."
                    ]}
                    delay={1400}
                  />
                </>
              )}
            </div>
          )}

          {/* Phase 2: Kim's API Work */}
          {isPast("kim_work") && (
            <div className="mt-4">
              <CodexSeparator />
              <div className="flex gap-2 text-zinc-200 text-[11.5px] font-bold mb-3">
                <span className="text-zinc-500">›</span>
                <span className="flex">
                  {isExact("kim_work") ? <AnimatedText text="build the /api/analytics endpoints" /> : "build the /api/analytics endpoints"}
                  {isExact("kim_work") && <BlinkingCursor />}
                </span>
              </div>

              {isPast("type_intent") && (
                <>
                  <CodexAction
                    command={<>Called <span className="text-[#61AFEF]">Orkestrate.identify_intent</span></>}
                    returns={["Identified intent 'implement' for Orkestrate CLI-0113df5fb8."]}
                    delay={200}
                  />
                  <CodexAction
                    command={<>Called <span className="text-[#61AFEF]">Orkestrate.read_team_state</span></>}
                    returns={["Workflow phase=read. Next required tool: claim_scope."]}
                    delay={800}
                  />
                </>
              )}
            </div>
          )}

          {/* Phase 3: Kim Claims & Pushes (kim_claim) */}
          {isPast("kim_claim") && (
            <div className="mt-2">
              <CodexAction
                command={<>Called <span className="text-[#61AFEF]">Orkestrate.claim_scope</span></>}
                returns={["Scope claimed for path: '/api/analytics/**'"]}
                delay={200}
              />
              <CodexAction
                command={<>Called <span className="text-[#61AFEF]">Orkestrate.update_my_state</span></>}
                returns={[
                  "Successfully updated state.",
                  "Pushed new schema to team state. Alex and Sam should see the new headers instantly."
                ]}
                delay={1000}
              />
            </div>
          )}

          {/* Idle Cursor (Shows when waiting for OpenCode/Codex to finish) */}
          {showIdleCursor && !submittedQuery && (
            <div className="mt-4 flex flex-col gap-1 text-[11px] text-zinc-500">
              <div className="flex gap-2 items-center text-zinc-200 font-bold">
                <span className="text-zinc-500">›</span>
                {isExact("end") ? (
                  <textarea
                    autoFocus
                    rows={1}
                    value={userQuery}
                    onChange={(e) => {
                      setUserQuery(e.target.value);
                      e.target.style.height = 'auto';
                      e.target.style.height = `${e.target.scrollHeight}px`;
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        if (userQuery.trim()) {
                          setSubmittedQuery(userQuery);
                          setUserQuery("");
                          setTimeout(() => setShowResponse(true), 600);
                        }
                      }
                    }}
                    className="w-full bg-transparent border-none outline-none text-white font-mono resize-none overflow-hidden mt-0 align-top leading-tight"
                    style={{ boxShadow: 'none' }}
                  />
                ) : (
                  <BlinkingCursor />
                )}
              </div>
              <div className="mt-1 flex gap-2 font-mono text-zinc-500 opacity-60">
                gpt-5.4-codex xhigh · 95% left · ~\Orkestrate
              </div>
            </div>
          )}

          {/* User Interactive Chat Phase */}
          {submittedQuery && (
            <div className="mt-4 flex flex-col gap-1 text-[11px] text-zinc-500">
              <div className="flex gap-2 items-center text-zinc-200 font-bold">
                <span className="text-zinc-500">›</span>
                <span>{submittedQuery}</span>
              </div>
              
              {showResponse && (
                <div className="mt-2">
                  <CodexAction
                    command={<>Called <span className="text-[#61AFEF]">Orkestrate.identify_intent</span></>}
                    returns={["Analyzing request...", "Linking required accounts."]}
                    delay={200}
                  />
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} className="flex gap-2 text-[11px] text-zinc-300 mt-2">
                    <span className="text-[#E5C07B]">⚠</span>
                    <span>
                      I'll need to link your account to perform that action. <br/>
                      Please <a href="/login" className="text-[#61AFEF] hover:underline underline-offset-2">Sign in</a> to grant access, or open your <a href="/dashboard" className="text-[#98C379] hover:underline underline-offset-2">Dashboard</a>.
                    </span>
                  </motion.div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
};