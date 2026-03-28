"use client";

import { Logo } from "@/components/brand/Logo";

type StepWelcomeProps = {
  onContinue: () => void;
};

const capabilityChips = [
  "Agent state awareness",
  "Collision-safe file claims",
  "Cross-tool MCP orchestration",
];


export function StepWelcome({ onContinue }: StepWelcomeProps) {
  return (
    <div className="flex flex-col items-center py-6">
      <button
        type="button"
        className="h-11 rounded-full border border-white/10 bg-zinc-800 px-12 text-[15px] font-semibold text-zinc-300 transition-all hover:bg-zinc-700 active:scale-[0.98]"
        onClick={onContinue}
      >
        Get started
      </button>
    </div>
  );
}
