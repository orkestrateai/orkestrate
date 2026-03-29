"use client";

import { useState } from "react";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";
import { useGitHubConnection } from "@/hooks/useGitHubConnection";
import type { OnboardingWorkspace } from "@/types/onboarding";

type StepWorkspaceProps = {
  workspaceReady: boolean;
  activeWorkspace: OnboardingWorkspace;
  onWorkspaceUpdated: () => Promise<void> | void;
  onContinue: () => void;
};

export function StepWorkspace({
  workspaceReady,
  activeWorkspace,
  onWorkspaceUpdated,
  onContinue,
}: StepWorkspaceProps) {
  const [repoUrl, setRepoUrl] = useState("");
  const [baseBranch, setBaseBranch] = useState("main");
  const [workspaceName, setWorkspaceName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [showBranches, setShowBranches] = useState(false);
  const [error, setError] = useState("");

  const {
    isConnected,
    isChecking,
    repos,
    isLoadingRepos,
    isBrowsingRepos,
    setIsBrowsingRepos,
    fetchRepos,
    branches,
    isLoadingBranches,
    fetchBranches,
  } = useGitHubConnection();

  const handleCreateWorkspace = async () => {
    if (!workspaceName.trim()) {
      setError("Workspace name is required.");
      return;
    }

    setIsCreating(true);
    setError("");
    try {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setError("Authentication required. Refresh and try again.");
        return;
      }

      const response = await fetch("/api/workspaces", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: "create",
          repoUrl: repoUrl.trim() || undefined,
          baseBranch: baseBranch.trim() || "main",
          name: workspaceName.trim(),
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || "Failed to create workspace.");
        return;
      }

      await onWorkspaceUpdated();
    } catch {
      setError("Failed to create workspace.");
    } finally {
      setIsCreating(false);
    }
  };

  if (workspaceReady && activeWorkspace) {
    return (
      <div className="flex flex-col items-center py-6">
        <div className="flex flex-col items-center gap-2 mb-10">
          <div className="flex items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.02] px-4 py-1 text-[12px] font-semibold text-zinc-400">
            <div className="h-1.5 w-1.5 rounded-full bg-zinc-600 shadow-[0_0_10px_rgba(255,255,255,0.05)]" />
            {activeWorkspace.name} Verified
          </div>
          {activeWorkspace.repoUrl && (
            <div className="text-[11px] text-zinc-600">{activeWorkspace.repoUrl}</div>
          )}
        </div>

        <button
          type="button"
          onClick={onContinue}
          className="h-11 w-full max-w-[280px] rounded-full border border-white/10 bg-zinc-800 text-[15px] font-semibold text-zinc-300 transition-all hover:bg-zinc-700 active:scale-[0.98]"
        >
          Continue
        </button>
      </div>
    );
  }

  if (isChecking) {
    return (
      <div className="flex h-40 flex-col items-center justify-center gap-3">
        <Loader2 className="h-5 w-5 animate-spin text-zinc-600" />
        <span className="text-[13px] text-zinc-500">Checking GitHub connection...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2 text-left">
          <label className="text-xs uppercase tracking-[0.12em] text-zinc-500">
            Workspace name
          </label>
          <input
            type="text"
            value={workspaceName}
            onChange={(event) => setWorkspaceName(event.target.value)}
            placeholder="e.g. My Shared Room"
            className="h-10 w-full rounded-full border border-white/10 bg-white/[0.02] px-4 text-[13px] text-zinc-300 outline-none transition-colors focus:border-white/20"
          />
        </div>

        {isConnected ? (
          <div className="space-y-4 pt-4 border-t border-white/5">
            <div className="space-y-2 text-left">
              <label className="text-xs uppercase tracking-[0.12em] text-zinc-500 flex items-center justify-between">
                GitHub Repository (Optional)
                <span className="text-[10px] lowercase tracking-normal text-zinc-600">Connect to sync coordination</span>
              </label>

              {isBrowsingRepos ? (
                <div className="max-h-40 overflow-y-auto rounded-xl border border-white/5 bg-white/[0.01]">
                  {repos.length === 0 ? (
                    <div className="px-4 py-5 text-[13px] text-zinc-500">No repositories found.</div>
                  ) : (
                    repos.map((repo) => (
                      <button
                        key={repo.full_name}
                        type="button"
                        onClick={() => {
                          setRepoUrl(repo.url);
                          if (!workspaceName) setWorkspaceName(repo.name);
                          setBaseBranch(repo.default_branch || "main");
                          setIsBrowsingRepos(false);
                          void fetchBranches(repo.url);
                        }}
                        className="flex w-full items-center justify-between border-b border-white/5 px-4 py-3 text-left last:border-b-0 hover:bg-white/[0.03]"
                      >
                        <div>
                          <div className="text-[13px] text-zinc-200">{repo.full_name}</div>
                          <div className="text-[11px] text-zinc-500 truncate max-w-[200px]">
                            {repo.description || "No description"}
                          </div>
                        </div>
                        <Check className={cn("h-3.5 w-3.5 text-zinc-500 opacity-0", repoUrl === repo.url && "opacity-100")} />
                      </button>
                    ))
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => void fetchRepos()}
                  disabled={isLoadingRepos}
                  className="inline-flex h-10 w-full items-center justify-between rounded-full border border-white/10 bg-white/[0.02] px-4 text-[13px] text-zinc-300 hover:bg-white/[0.05] disabled:opacity-60"
                >
                  <span className="truncate">
                    {repoUrl ? repoUrl : "Browse repositories..."}
                  </span>
                  {isLoadingRepos ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />
                  )}
                </button>
              )}
            </div>

            {repoUrl && (
              <div className="space-y-2 text-left animate-in fade-in slide-in-from-top-2 duration-300">
                <label className="text-xs uppercase tracking-[0.12em] text-zinc-500">
                  Base branch
                </label>
                <div className="relative">
                  <button
                    type="button"
                    disabled={!repoUrl || isLoadingBranches}
                    onClick={() => setShowBranches((o: boolean) => !o)}
                    className="inline-flex h-10 w-full items-center justify-between rounded-full border border-white/10 bg-white/[0.02] px-4 text-[13px] text-zinc-300 transition-all hover:bg-white/[0.05] disabled:opacity-60"
                  >
                    <span className="truncate">
                      {isLoadingBranches ? "Loading branches..." : baseBranch || "Select branch"}
                    </span>
                    <ChevronDown
                      className={cn(
                        "h-3.5 w-3.5 text-zinc-500 transition-transform duration-200",
                        showBranches && "rotate-180",
                      )}
                    />
                  </button>

                  <AnimatePresence>
                    {showBranches && (
                      <div className="relative z-50">
                        <div
                          className="fixed inset-0"
                          onClick={() => setShowBranches(false)}
                        />
                        <motion.div
                          initial={{ opacity: 0, y: 4, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 4, scale: 0.98 }}
                          transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                          className="absolute right-0 top-full z-50 mt-2 max-h-56 w-full overflow-y-auto rounded-xl border border-white/10 bg-[#121214] p-1 shadow-xl shadow-black/50"
                        >
                          {branches.map((branch) => (
                            <button
                              key={branch.name}
                              type="button"
                              onClick={() => {
                                setBaseBranch(branch.name);
                                setShowBranches(false);
                              }}
                              className={cn(
                                "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors",
                                baseBranch === branch.name
                                  ? "bg-white/10 text-white"
                                  : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200",
                              )}
                            >
                              {branch.name}
                              {baseBranch === branch.name && <Check className="h-3.5 w-3.5" />}
                            </button>
                          ))}
                        </motion.div>
                      </div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-white/5 bg-white/[0.01] p-4 text-center">
            <p className="text-[12px] text-zinc-500 leading-relaxed">
              Tip: You can connect GitHub later to enable git-rooted coordination for your agents.
            </p>
          </div>
        )}
      </div>

      {error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      <button
        type="button"
        onClick={handleCreateWorkspace}
        disabled={isCreating || !workspaceName.trim()}
        className="h-11 w-full rounded-full border border-white/10 bg-zinc-800 text-[15px] font-semibold text-zinc-300 transition-all hover:bg-zinc-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isCreating ? (
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Creating workspace...</span>
          </div>
        ) : (
          "Create workspace"
        )}
      </button>
    </div>
  );
}
