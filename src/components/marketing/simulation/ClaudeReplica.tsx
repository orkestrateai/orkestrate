"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Minus, Square, X } from "lucide-react";
import { SimulationStep, STEPS } from "./types";

// ─── Shared UI Helpers ──────────────────────────────────────────────────────

const AnimatedText = ({ text, speed = 15 }: { text: string; speed?: number }) => {
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
    className="inline-block w-2 h-3.5 bg-zinc-400 align-middle ml-0.5"
  />
);

const PixelMascot = () => {
  const color = "#D86B52";
  return (
    <div className="relative w-16 h-10 mb-2 opacity-90 group-hover:opacity-100 transition-opacity">
      <div
        className="absolute inset-0"
        style={{
          boxShadow: `
            ${color} 12px 0, ${color} 16px 0, ${color} 20px 0, ${color} 24px 0, ${color} 28px 0, ${color} 32px 0,
            ${color} 12px 4px, ${color} 16px 4px, ${color} 20px 4px, ${color} 24px 4px, ${color} 28px 4px, ${color} 32px 4px,
            ${color} 0px 8px, ${color} 4px 8px, ${color} 8px 8px, ${color} 12px 8px, ${color} 16px 8px, ${color} 20px 8px, ${color} 24px 8px, ${color} 28px 8px, ${color} 32px 8px, ${color} 36px 8px, ${color} 40px 8px, ${color} 44px 8px,
            ${color} 0px 12px, ${color} 4px 12px, ${color} 8px 12px, ${color} 12px 12px, black 16px 12px, ${color} 20px 12px, ${color} 24px 12px, black 28px 12px, ${color} 32px 12px, ${color} 36px 12px, ${color} 40px 12px, ${color} 44px 12px,
            ${color} 0px 16px, ${color} 4px 16px, ${color} 8px 16px, ${color} 12px 16px, ${color} 16px 16px, ${color} 20px 16px, ${color} 24px 16px, ${color} 28px 16px, ${color} 32px 16px, ${color} 36px 16px, ${color} 40px 16px, ${color} 44px 16px,
            ${color} 12px 20px, ${color} 16px 20px, ${color} 20px 20px, ${color} 24px 20px, ${color} 28px 20px, ${color} 32px 20px,
            ${color} 12px 24px, ${color} 16px 24px, ${color} 28px 24px, ${color} 32px 24px,
            ${color} 12px 28px, ${color} 16px 28px, ${color} 28px 28px, ${color} 32px 28px
          `,
          width: '4px',
          height: '4px'
        }}
      />
    </div>
  );
};

// ─── High-Speed Tool Component ─────────────────────────────────────────────

interface ClaudeToolProps {
  name: string;
  args?: string;
  returns: string[];
  delay?: number;
  duration?: string;
}

const ClaudeTool = ({ name, args, returns, delay = 0, duration }: ClaudeToolProps) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ delay: delay / 1000 }}
    className="space-y-1.5 font-mono text-[12px] pt-1"
  >
    <div className="flex gap-2">
      <span className="text-[#4ADE80]">●</span>
      <span className="text-[#4ADE80]">
        {name}
        {args && <span className="text-zinc-400">{args}</span>}
      </span>
    </div>

    <div className="flex flex-col space-y-1 text-zinc-400 pl-4">
      {returns.map((ret, idx) => (
        <motion.div
          key={idx}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: (delay + 100 + (idx * 150)) / 1000 }} // Lightning fast returns
          className="flex gap-2 whitespace-pre-wrap leading-relaxed"
        >
          <span className="text-zinc-500 shrink-0">⎿ </span>
          <span>{ret}</span>
        </motion.div>
      ))}
    </div>

    {duration && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: (delay + returns.length * 150 + 300) / 1000 }}
        className="text-zinc-500 italic pt-2 pb-1"
      >
        ✻ {duration}
      </motion.div>
    )}
  </motion.div>
);

// ─── Main Component ─────────────────────────────────────────────────────────

export const ClaudeReplica = ({ stepId }: { stepId: SimulationStep }) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [userQuery, setUserQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [showResponse, setShowResponse] = useState(false);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const observer = new MutationObserver(() => {
      el.scrollTop = el.scrollHeight; // Safe auto-scroll
    });
    observer.observe(el, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, []);

  // Workflow Progress Evaluators
  const stepIdx = STEPS.findIndex(s => s.id === stepId);
  const isPast = (id: SimulationStep) => stepIdx >= STEPS.findIndex(s => s.id === id);
  const isExact = (id: SimulationStep) => stepId === id;

  const showIdleCursor = ["start", "kim_work", "kim_claim", "sam_sync", "end"].includes(stepId);
  return (
    <div className="absolute inset-0 flex flex-col bg-[#0F0F11] border border-white/[0.08] rounded-xl overflow-hidden font-mono shadow-2xl text-left">

      {/* OS Header */}
      <div className="flex shrink-0 items-center px-4 py-2 bg-[#0F0F11] border-b border-white/[0.04] select-none h-10">
        <div className="flex gap-2">
          <div className="w-4 h-4 rounded bg-[#D86B52] flex items-center justify-center">
            <div className="w-2 h-2 bg-white rounded-sm" />
          </div>
          <span className="text-[10px] text-zinc-300 font-sans tracking-wide">Claude Code</span>
        </div>
        <div className="ml-auto flex gap-4 text-zinc-500">
          <Minus className="w-3 h-3 cursor-pointer hover:text-zinc-300" />
          <Square className="w-2.5 h-2.5 cursor-pointer hover:text-zinc-300" />
          <X className="w-3 h-3 cursor-pointer hover:text-zinc-300" />
        </div>
      </div>

      {/* Scrollable Area */}
      <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-3 text-[11px] leading-relaxed custom-scrollbar pb-6 scroll-smooth">

        {/* Top Bar */}
        <div className="flex justify-between items-center text-zinc-500 mb-3 px-1 text-[10px]">
          <span>? for shortcuts</span>
          <div className="flex items-center gap-2">
            <span>Checking for updates</span>
          </div>
        </div>

        {/* Welcome Box */}
        <div className="border border-[#D86B52]/40 rounded-md relative p-3 flex flex-col md:flex-row gap-4 mb-6 mt-2">
          <div className="absolute -top-2 left-4 bg-[#0F0F11] px-1.5 text-[#D86B52] text-[9px] font-bold">
            Claude Code v2.1.84
          </div>
          <div className="flex-1 flex flex-col items-center justify-center md:border-r border-[#D86B52]/20 pr-3">
            <div className="font-bold text-zinc-100 mb-2 tracking-wide text-[11px]">Welcome back!</div>
            <PixelMascot />
            <div className="text-[9px] text-zinc-400 text-center leading-tight mt-1">
              claude-sonnet-4.5 · API Usage Billing<br />
              <span className="opacity-60">~\Orkestrate</span>
            </div>
          </div>
          <div className="flex-[1.5] pl-1 flex flex-col justify-center space-y-3">
            <div>
              <div className="text-[#D86B52] text-[9px] mb-1 font-bold uppercase tracking-wider">Tips for starting</div>
              <div className="text-zinc-300 text-[9px] font-light italic opacity-80">Run /init to create CLAUDE.md</div>
            </div>
            <div className="h-px w-full bg-[#D86B52]/10" />
            <div>
              <div className="text-[#D86B52] text-[9px] mb-1 font-bold uppercase tracking-wider">Recent activity</div>
              <div className="text-zinc-500 text-[9px] font-light italic">No recent activity</div>
            </div>
          </div>
        </div>

        <div className="space-y-5 px-1 pb-4">

          {/* Phase 1: Join Workspace */}
          {isPast("type_join") && (
            <div className="space-y-3">
              <div className="flex gap-2 text-zinc-200">
                <span className="text-zinc-500 font-bold">{">"}</span>
                <span className="font-bold flex">
                  {isExact("type_join") ? <AnimatedText text="join workspace" /> : "join workspace"}
                  {isExact("type_join") && <BlinkingCursor />}
                </span>
              </div>

              {isPast("exec_join") && (
                <>
                  <ClaudeTool
                    name="Bash"
                    args="(git rev-parse HEAD)"
                    returns={["6e13a5428d3d328783ad5d246e06d5f44e269fff"]}
                    delay={100}
                  />
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="flex gap-2 text-zinc-200">
                    <span className="text-zinc-400">●</span>
                    <span>Successfully joined workspace ws_44f87 as agent claude-b23.</span>
                  </motion.div>
                </>
              )}
            </div>
          )}

          {/* Phase 2: Identify Intent */}
          {isPast("type_intent") && (
            <div className="space-y-3 pt-2 border-t border-white/[0.04]">
              <div className="flex gap-2 text-zinc-200">
                <span className="text-zinc-500 font-bold">{">"}</span>
                <span className="font-bold flex">
                  {isExact("type_intent") ? <AnimatedText text="refactor analytics.css" /> : "refactor analytics.css"}
                  {isExact("type_intent") && <BlinkingCursor />}
                </span>
              </div>

              {isPast("exec_intent") && (
                <>
                  <ClaudeTool
                    name="Orkestrate - identify_intent (MCP)"
                    args={`(userPrompt: "refactor analytics.css")`}
                    returns={[
                      "Identified intent 'implement' for claude-b23.",
                      "Workflow phase=identified. Next required: read_team_state.",
                      "{\n  \"ok\": true, \"intentId\": \"implement\", ... }"
                    ]}
                    delay={100}
                  />
                  <ClaudeTool
                    name="Orkestrate - read_team_state (MCP)"
                    returns={[
                      "- opencode-b23 (active) | footprint: 2 paths",
                      "Workflow phase=read. Next required: claim_scope."
                    ]}
                    delay={600}
                  />
                </>
              )}
            </div>
          )}

          {/* Phase 3: Fix & Update */}
          {isPast("type_fix") && (
            <div className="space-y-3 pt-2 border-t border-white/[0.04]">
              <div className="flex gap-2 text-zinc-200">
                <span className="text-zinc-500 font-bold">{">"}</span>
                <span className="font-bold flex">
                  {isExact("type_fix") ? <AnimatedText text="fix race condition in settings" /> : "fix race condition in settings"}
                  {isExact("type_fix") && <BlinkingCursor />}
                </span>
              </div>

              {isPast("exec_fix") && (
                <>
                  <ClaudeTool
                    name="Orkestrate - claim_scope (MCP)"
                    args={`(paths: ["src/app/dashboard/settings/page.tsx"])`}
                    returns={["Scope claimed for claude-b23.", "Workflow phase=claimed."]}
                    delay={100}
                  />
                  <ClaudeTool
                    name="Update(src/app/dashboard/settings/page.tsx)"
                    returns={["Added 2 lines, removed 2 lines", "226 -   void saveSettings();\n226 +   await saveSettings();"]}
                    delay={600}
                  />
                  <ClaudeTool
                    name="Orkestrate - update_my_state (MCP)"
                    args={`(content: {"status": "done", ...})`}
                    returns={["Successfully updated state.", "Workflow phase=active. stateHash=v13cc7c74710a"]}
                    delay={1100}
                    duration="Worked for 1m 12s"
                  />
                </>
              )}
            </div>
          )}

          {/* Phase 4: Release Scope */}
          {isPast("exec_release") && (
            <div className="space-y-3">
              <ClaudeTool
                name="Orkestrate - release_scope (MCP)"
                args={`(claimId: "claim_812e36391cd14764")`}
                returns={[
                  "Released scope claim claim_812e36391cd14764.",
                  "Workflow phase=done. Reason: Claim released."
                ]}
                delay={200}
              />
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }} className="flex gap-2 text-zinc-200 pt-2">
                <span className="text-zinc-400">●</span>
                <span>Done! The MCP tool settings save functionality is now fixed.</span>
              </motion.div>
            </div>
          )}

          {/* Idle Cursor (Only shows when waiting for user input) */}
          {showIdleCursor && !submittedQuery && (
            <div className="flex gap-2 items-center text-zinc-200 mt-2">
              <span className="text-zinc-500 font-bold">{">"}</span>
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
          )}

          {/* User Interactive Chat Phase */}
          {submittedQuery && (
            <div className="space-y-3 pt-2 border-t border-white/[0.04] mt-2">
              <div className="flex gap-2 text-zinc-200">
                <span className="text-zinc-500 font-bold">{">"}</span>
                <span className="font-bold">{submittedQuery}</span>
              </div>
              
              {showResponse && (
                <>
                  <ClaudeTool
                    name="Orkestrate - identify_intent (MCP)"
                    args={`(userPrompt: "${submittedQuery}")`}
                    returns={["Analyzing request...", "Linking required accounts."]}
                    delay={200}
                  />
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} className="flex gap-2 text-zinc-200 pt-2">
                    <span className="text-[#4ADE80]">●</span>
                    <span>
                      I'll need to link your account to perform that action. <br/>
                      Please <a href="/login" className="text-[#4ADE80] hover:underline underline-offset-2">Sign in</a> to grant access, or open your <a href="/dashboard" className="text-[#D86B52] hover:underline underline-offset-2">Dashboard</a>.
                    </span>
                  </motion.div>
                </>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
};