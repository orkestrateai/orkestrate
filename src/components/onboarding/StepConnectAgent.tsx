"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

type ToolOption =
  | "claude"
  | "opencode"
  | "cursor"
  | "windsurf"
  | "codex"
  | "zed";

const toolOptions: Array<{ id: ToolOption; label: string }> = [
  { id: "claude", label: "Claude Code" },
  { id: "opencode", label: "OpenCode" },
  { id: "cursor", label: "Cursor" },
  { id: "windsurf", label: "Windsurf" },
  { id: "codex", label: "Codex CLI" },
  { id: "zed", label: "Zed" },
];

type StepConnectAgentProps = {
  hasEverJoinedAgent: boolean;
  activeAgentCount: number;
  workspaceId: string | null;
  isRefreshing: boolean;
  onRefresh: () => void;
  onOpenWorkspace: () => void;
};

export function StepConnectAgent({
  hasEverJoinedAgent,
  activeAgentCount,
  workspaceId,
  isRefreshing,
  onRefresh,
  onOpenWorkspace,
}: StepConnectAgentProps) {
  const [selectedTool, setSelectedTool] = useState<ToolOption>("claude");
  const [copied, setCopied] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const commands = useMemo(
    () => [
      "bun install -g orkestrate",
      "orkestrate login",
      "orkestrate init",
      `orkestrate connect ${selectedTool}`,
      "orkestrate agent join workspace",
    ],
    [selectedTool],
  );

  const selectedToolLabel =
    toolOptions.find((t) => t.id === selectedTool)?.label || selectedTool;

  const copyCommand = async (command: string) => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(command);
      window.setTimeout(() => setCopied(null), 1200);
    } catch {
      // no-op
    }
  };

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <div className="px-1 text-[11px] font-bold uppercase tracking-[0.15em] text-zinc-600">
          I&apos;m coding in...
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className={`flex h-12 w-full items-center justify-between rounded-2xl border bg-white/1 px-5 text-sm font-semibold transition-all duration-300 ${
              isDropdownOpen
                ? "border-white/20 bg-white/4 text-white shadow-2xl"
                : "border-white/5 text-zinc-400 hover:border-white/10 hover:bg-white/2"
            }`}
          >
            <span>{selectedToolLabel}</span>
            <motion.div
              animate={{ rotate: isDropdownOpen ? 180 : 0 }}
              transition={{ duration: 0.3 }}
            >
              <ChevronDown
                className={`h-4 w-4 transition-colors ${isDropdownOpen ? "text-white" : "text-zinc-600"}`}
              />
            </motion.div>
          </button>

          <AnimatePresence>
            {isDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsDropdownOpen(false)}
                />
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 6 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute left-0 right-0 z-50 overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/90 p-1 shadow-2xl backdrop-blur-3xl"
                >
                  <div className="no-scrollbar max-h-60 overflow-y-auto">
                    {toolOptions.map((tool) => (
                      <button
                        key={tool.id}
                        type="button"
                        onClick={() => {
                          setSelectedTool(tool.id);
                          setIsDropdownOpen(false);
                        }}
                        className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-left text-[13px] font-semibold transition-all ${
                          selectedTool === tool.id
                            ? "bg-white/10 text-white"
                            : "text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
                        }`}
                      >
                        {tool.label}
                        {selectedTool === tool.id && (
                          <div className="h-1.5 w-1.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.5)]" />
                        )}
                      </button>
                    ))}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="space-y-2 rounded-2xl border border-white/5 bg-white/1 p-2">
        {commands.map((command) => (
          <div
            key={command}
            className="group flex items-center justify-between rounded-xl px-3 py-2 transition-colors hover:bg-white/2"
          >
            <code className="truncate pr-3 text-[13px] font-semibold text-zinc-400 transition-colors group-hover:text-zinc-300">
              {command}
            </code>
            <button
              type="button"
              onClick={() => void copyCommand(command)}
              className="h-8 rounded-lg px-3 text-[11px] font-bold text-zinc-400 transition-colors hover:text-white hover:bg-white/5"
            >
              {copied === command ? "Copied" : "Copy"}
            </button>
          </div>
        ))}
      </div>

      <div className="flex flex-col items-center gap-6 pt-10">
        <p className="max-w-[320px] text-center text-[11px] leading-relaxed font-medium text-zinc-500 transition-opacity">
          Paste these commands into your terminal to connect your agent. Once done, proceed to your dashboard.
        </p>
        
        <button
          type="button"
          onClick={onOpenWorkspace}
          className="flex h-11 w-full max-w-[320px] items-center justify-center gap-2 rounded-full border border-white/10 bg-zinc-800 text-[15px] font-semibold text-zinc-300 transition-all hover:bg-zinc-700 hover:text-white active:scale-[0.98]"
        >
          {isRefreshing && <Loader2 className="h-4 w-4 animate-spin" />}
          Open dashboard
        </button>
      </div>
    </div>
  );
}
