"use client";

import { Loader2 } from "lucide-react";
import { GitHubReconnectButton } from "@/components/auth/GitHubReconnectButton";

type StepGitHubProps = {
  githubConnected: boolean;
  isRefreshing?: boolean;
  onContinue: () => void;
};

export function StepGitHub({
  githubConnected,
  isRefreshing,
  onContinue,
}: StepGitHubProps) {
  return (
    <div className="flex flex-col items-center gap-10 py-4">
      <div className="flex flex-col items-center gap-3">
        {isRefreshing ? (
          <div className="flex items-center gap-3 rounded-full border border-white/5 bg-white/[0.01] px-4 py-1.5 text-[12px] font-medium text-zinc-500">
            <Loader2 className="h-3 w-3 animate-spin" />
            Checking GitHub status...
          </div>
        ) : githubConnected ? (
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.02] px-4 py-1 text-[12px] font-medium text-zinc-400">
            <div className="h-1.5 w-1.5 rounded-full bg-zinc-600" />
            GitHub connection verified
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <GitHubReconnectButton
              label="Connect GitHub Account"
              className="text-[14px] text-zinc-400 hover:text-white transition-colors underline underline-offset-4 decoration-zinc-800 hover:decoration-zinc-400"
            />
            <button
               onClick={onContinue}
               className="text-[12px] text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              Skip for now
            </button>
          </div>
        )}
      </div>

      {githubConnected && (
        <button
          type="button"
          onClick={onContinue}
          className="h-11 w-full max-w-[280px] rounded-full border border-white/10 bg-zinc-800 text-[15px] font-semibold text-zinc-200 transition-all hover:bg-zinc-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Continue
        </button>
      )}
    </div>
  );
}
