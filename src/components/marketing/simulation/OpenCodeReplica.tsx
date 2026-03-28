"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronDown, ArrowUp, ShieldCheck } from "lucide-react";

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
    className="inline-block w-2 h-3.5 bg-zinc-400 align-middle ml-1"
  />
);

// ─── OpenCode Specific UI Blocks ────────────────────────────────────────────

const OCUserMessage = ({ text }: { text: string }) => (
  <motion.div
    initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
    className="bg-white/[0.04] rounded-lg p-3 my-4 text-[12.5px] text-zinc-200"
  >
    {text}
  </motion.div>
);

const OCShell = ({ title, command, output, error = false, delay = 0 }: { title: string; command: string; output: string; error?: boolean; delay?: number }) => (
  <motion.div
    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: delay / 1000 }}
    className="my-4"
  >
    <div className="text-[11px] text-zinc-400 mb-2 flex items-center gap-1.5 cursor-pointer hover:text-zinc-300">
      <span className="font-mono text-zinc-500">Shell</span>
      <span className="text-zinc-300">{title}</span>
      <ChevronDown className="w-3 h-3 ml-1" />
    </div>
    <div className="bg-[#1C1C1E] border border-white/[0.04] rounded-lg p-3.5 font-mono text-[11.5px] space-y-3">
      <div className="text-zinc-200">$ {command}</div>
      <div className={error ? "text-red-400" : "text-zinc-400"}>{output}</div>
    </div>
  </motion.div>
);

const OCThought = ({ text, delay = 0 }: { text: string; delay?: number }) => (
  <motion.div
    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: delay / 1000 }}
    className="text-zinc-400 my-2 text-[12px] leading-relaxed"
  >
    <span className="text-[#E5B567] italic font-serif tracking-wide mr-2">Thinking:</span>
    {text}
  </motion.div>
);

const OCAction = ({ icon = "⚙", text, delay = 0 }: { icon?: string; text: string; delay?: number }) => (
  <motion.div
    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: delay / 1000 }}
    className="text-zinc-300 font-mono text-[11.5px] my-2 flex gap-2"
  >
    <span className="text-zinc-500">{icon}</span>
    <span className="break-all">{text}</span>
  </motion.div>
);

// ─── Main Component ─────────────────────────────────────────────────────────

export const OpenCodeReplica = ({ stepId }: { stepId: SimulationStep }) => {
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

  const getTypingText = () => {
    if (isExact("type_join")) return "join workspace";
    if (isExact("kim_work")) return "Check the db for the mcp tool enabling and disabling";
    if (isExact("kim_claim")) return "What do the other workspace agents think";
    if (isExact("sam_sync")) return "B, I prefer B. Work with the other agents in the workspace to implement it";
    return null;
  };

  const typingText = getTypingText();

  return (
    <div className="absolute inset-0 flex flex-col bg-[#111111] border border-white/[0.08] rounded-xl overflow-hidden shadow-2xl text-left font-sans">

      {/* IDE Header */}
      <div className="flex shrink-0 items-end bg-[#0A0A0A] border-b border-white/[0.06] h-11 px-3 select-none">
        <div className="flex items-center gap-2 px-3 py-2 bg-[#1E1E1E] border border-white/[0.06] rounded-t-md border-b-0">
          <span className="text-[11px] text-zinc-300 font-medium">OpenCode</span>
          <X className="w-3 h-3 text-zinc-500 ml-4 hover:text-zinc-300 cursor-pointer" />
        </div>
      </div>

      {/* Main Terminal Stream */}
      <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6 custom-scrollbar scroll-smooth">
        <div className="max-w-2xl space-y-2 pb-6">

          {/* Phase 1: Join Workspace (Initialization) */}
          {isPast("exec_join") && (
            <div className="space-y-1">
              <OCUserMessage text="join workspace" />

              {isPast("exec_join") && (
                <>
                  <OCShell
                    title="Get current git branch"
                    command="git rev-parse --abbrev-ref HEAD"
                    output="main"
                    delay={100}
                  />
                  <OCShell
                    title="Get current HEAD commit"
                    command="git rev-parse HEAD"
                    output="1fe306d9a249282873c73338d425d14f80867181"
                    delay={600}
                  />
                  <OCShell
                    title="Get git remote URL"
                    command="git remote get-url origin"
                    output="error: No such remote 'origin'"
                    error={true}
                    delay={1100}
                  />
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.6 }} className="text-zinc-300 my-4 text-[12px]">
                    Joined workspace successfully. Ready for your next task.
                  </motion.div>
                </>
              )}
            </div>
          )}

          {/* Phase 2: Check DB (kim_work) */}
          {isPast("type_intent") && (
            <div className="space-y-1 border-t border-white/[0.04] pt-2 mt-4">
              <OCUserMessage text="Check the db for the mcp tool enabling and disabling" />

              {isPast("type_intent") && (
                <>
                  <OCThought text="The user wants me to check the database for MCP tool enabling/disabling. This likely means checking the user_mcp_settings table." delay={200} />
                  <OCAction icon="✱" text='Grep "userMcpSettings|mcp_settings" (11 matches)' delay={600} />
                  <OCThought text="Let me read the API route to understand how the MCP settings are being used..." delay={1000} />
                  <OCAction icon="→" text="Read src\app\api\users\me\mcp-settings\route.ts" delay={1400} />

                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.8 }} className="text-zinc-300 my-4 text-[12px] leading-relaxed bg-[#1A1A1A] p-4 rounded-lg border border-white/[0.04]">
                    The MCP settings infrastructure exists but isn't being enforced:<br /><br />
                    <span className="text-white font-medium">What's implemented:</span><br />
                    - <code className="text-[#4A90E2]">userMcpSettings</code> table in schema.ts<br />
                    - API at <code className="text-[#4A90E2]">/api/users/me/mcp-settings</code> for CRUD<br /><br />
                    <span className="text-white font-medium">What's NOT implemented:</span><br />
                    - The MCP route only checks OAuth scopes.<br />
                    - It does not filter tools based on disabled tools list.<br /><br />
                    Want me to implement the enforcement?
                  </motion.div>
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.2 }} className="flex items-center gap-2 text-zinc-500 text-[10px] py-2 font-mono">
                    <span className="text-[#4A90E2] text-sm">▣</span> Build · minimax-m2.7 · 1m 1s
                  </motion.div>
                </>
              )}
            </div>
          )}

          {/* Phase 3: Team Coordination (kim_claim) */}
          {isPast("type_fix") && (
            <div className="space-y-1 border-t border-white/[0.04] pt-2 mt-4">
              <OCUserMessage text="What do the other workspace agents think" />

              {isPast("type_fix") && (
                <>
                  <OCThought text="I should send a message to the other agents asking for their thoughts on the MCP tool permissions implementation." delay={200} />
                  <OCAction text="Orkestrate_send_message [toAgentId=@everyone, message=I found that userMcpSettings table exists but...]" delay={600} />
                  <OCThought text="I've broadcast the message to all agents. Now I should wait for responses." delay={1000} />
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.4 }} className="text-zinc-300 my-3 text-[12px]">
                    Asked the team. Waiting for responses.
                  </motion.div>
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.6 }} className="flex items-center gap-2 text-zinc-500 text-[10px] py-1 font-mono">
                    <span className="text-[#4A90E2] text-sm">▣</span> Build · minimax-m2.7 · 16.9s
                  </motion.div>
                </>
              )}
            </div>
          )}

          {/* Phase 4: Sync & Implement (sam_sync) */}
          {isPast("exec_release") && (
            <div className="space-y-1 border-t border-white/[0.04] pt-2 mt-4">
              <OCUserMessage text="B, I prefer B. Work with the other agents in the workspace to implement it" />

              {isPast("exec_release") && (
                <>
                  <OCThought text="The user wants Option B - discovery filter where tools don't appear in the advertised list if disabled." delay={200} />
                  <OCAction text="Orkestrate_send_message [toAgentId=@everyone, message=Implementing Option B...]" delay={600} />
                  <OCAction text="Orkestrate_claim_scope [expectedStateHash=vd8cfd309db63]" delay={1000} />
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.4 }} className="text-zinc-200 my-4 text-[12px] leading-relaxed">
                    Now let me implement. First, create the shared categories module:<br /><br />
                    <span className="font-bold text-white">Write</span> <code className="text-[#4ADE80]">mcp-categories.ts</code>
                  </motion.div>
                </>
              )}
            </div>
          )}

          {/* User Interactive Chat Phase */}
          {submittedQuery && (
            <div className="space-y-1 border-t border-white/[0.04] pt-2 mt-4">
              <OCUserMessage text={submittedQuery} />

              {showResponse && (
                <>
                  <OCAction text="Analyzing request..." delay={200} />
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} className="text-zinc-200 my-4 text-[12px] leading-relaxed bg-[#1A1A1A] p-4 rounded-lg border border-white/[0.04]">
                    I'll need you to connect your account to proceed with this task. <br /><br />
                    Please <a href="/login" className="text-[#4A90E2] hover:underline underline-offset-2">Sign in</a> to grant repository access, or return to your <a href="/dashboard" className="text-[#4ADE80] hover:underline underline-offset-2">Dashboard</a>.
                  </motion.div>
                </>
              )}
            </div>
          )}

        </div>
      </div>

      {/* IDE Input Footer */}
      <div className="p-3 bg-[#111111] shrink-0">
        <div className="bg-[#1C1C1E] border border-white/[0.04] rounded-xl p-3 shadow-inner relative">
          <div className="text-zinc-500 text-[12.5px] font-light mb-6 ml-1 min-h-[1.5rem] flex items-center w-full">
            {typingText ? (
              <div className="text-white relative flex items-center">
                <AnimatedText text={typingText} speed={15} />
                <BlinkingCursor />
              </div>
            ) : isExact("end") && !submittedQuery ? (
              <textarea
                autoFocus
                rows={1}
                placeholder="Ask anything..."
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
                className="w-full bg-transparent border-none outline-none text-white placeholder:text-zinc-500 font-sans resize-none overflow-hidden mt-0"
              />
            ) : (
              <span className="text-zinc-500">Ask anything...</span>
            )}
          </div>

          {/* Submit Button */}
          <div className="absolute right-3 top-3 w-7 h-7 bg-white/[0.08] hover:bg-white/[0.12] rounded-md flex items-center justify-center cursor-pointer transition-colors">
            <ArrowUp className="w-4 h-4 text-zinc-300" />
          </div>

          <div className="flex items-center justify-between text-[11px] font-medium">
            <div className="flex items-center gap-3">
              <span className="text-zinc-300 cursor-pointer hover:text-white flex items-center gap-1">Build <ChevronDown className="w-3 h-3 text-zinc-500" /></span>
              <span className="text-zinc-400 cursor-pointer hover:text-white flex items-center gap-1">MiniMax M2.7 <ChevronDown className="w-3 h-3 text-zinc-500" /></span>
              <span className="text-zinc-400 cursor-pointer hover:text-white flex items-center gap-1">Default <ChevronDown className="w-3 h-3 text-zinc-500" /></span>
              <ShieldCheck className="w-3.5 h-3.5 text-zinc-500" />
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};