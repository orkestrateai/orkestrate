"use client";

import React, { useState } from "react";
import {
  FolderTree,
  ChevronDown,
  Github,
  Loader2,
  X,
  ArrowLeft,
  CheckCircle2,
  Plus,
  ExternalLink,
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";
import { GitHubReconnectButton } from "@/components/auth/GitHubReconnectButton";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useGitHubConnection } from "@/hooks/useGitHubConnection";

export default function NewWorkspacePage() {
  const router = useRouter();
  const [repoUrl, setRepoUrl] = useState("");
  const [baseBranch, setBaseBranch] = useState("main");
  const [workspaceName, setWorkspaceName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
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

  const handleBrowseRepos = async () => {
    setError("");
    try {
      await fetchRepos();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch repositories.",
      );
    }
  };

  const handleCreate = async () => {
    if (!repoUrl.trim()) {
      setError("Git repository URL is required");
      return;
    }

    setIsCreating(true);
    setError("");

    try {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setError("Not authenticated");
        return;
      }

      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: "create",
          repoUrl: repoUrl.trim(),
          baseBranch: baseBranch.trim() || "main",
          name: workspaceName.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to create workspace");
        return;
      }

      router.push(`/dashboard/workspaces/${data.workspace.id}`);
    } catch {
      setError("Failed to create workspace");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="flex-1 bg-[#0A0A0B] min-h-screen text-[#EBEBEB] font-sans selection:bg-white/10 overflow-y-auto custom-scrollbar">
      <div className="max-w-3xl mx-auto px-8 py-20 animate-in fade-in slide-in-from-bottom-3 duration-500">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 text-[#8A8F98] hover:text-[#D1D3D8] transition-colors mb-12 text-[13px] font-medium group"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
          <span>Back to dashboard</span>
        </Link>

        {isChecking ? (
          <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] animate-in fade-in duration-1000">
            <div className="w-16 h-16 bg-white/[0.03] border border-white/[0.05] rounded-2xl flex items-center justify-center mb-6 shadow-2xl">
              <Loader2 className="w-8 h-8 text-white/50 animate-spin" />
            </div>
            <div className="text-[17px] text-[#868686] font-medium">
              Checking GitHub connection...
            </div>
          </div>
        ) : !isConnected ? (
          <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] animate-in fade-in duration-1000">
            <div className="w-16 h-16 bg-white/[0.03] border border-white/[0.05] rounded-2xl flex items-center justify-center mb-6 shadow-2xl">
              <Github className="w-8 h-8 text-white/50" />
            </div>
            <div className="text-[17px] text-[#868686] font-medium mb-4">
              You are not connected to GitHub yet.
            </div>
            <GitHubReconnectButton
              label="Connect"
              className="text-[15px] font-semibold text-white/90 hover:text-white transition-colors"
            />
          </div>
        ) : (
          <>
            <div className="mb-12 border-l border-white/10 pl-8">
              <h1 className="text-[32px] font-bold text-white tracking-tight mb-2">
                Create Workspace
              </h1>
              <p className="text-[#8A8F98] text-[15px]">
                Define your new environment and bind it to a Git repository.
              </p>
            </div>

            <div className="space-y-12 animate-in fade-in duration-700">
              {/* Repository Connection Section */}
              <section className="space-y-6">
                <div className="border-b border-white/5 pb-2">
                  <h2 className="text-[18px] font-medium text-[#F2F2F2] mb-1">
                    Git Repository
                  </h2>
                  <p className="text-[13px] text-[#8A8F98]">
                    Select the codebase that will power this workspace.
                  </p>
                </div>

                {isBrowsingRepos ? (
                  <div className="bg-[#16181A] border border-[#232529] rounded-[8px] overflow-hidden shadow-2xl">
                    <div className="p-3 border-b border-[#232529] bg-[#1A1C20] flex items-center justify-between">
                      <span className="text-[11px] text-[#5E626B] font-bold uppercase tracking-wider pl-2">
                        Available Repositories
                      </span>
                      <button
                        onClick={() => setIsBrowsingRepos(false)}
                        className="p-1 text-[#5E626B] hover:text-[#D1D3D8] transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="max-h-[360px] overflow-y-auto custom-scrollbar p-1">
                      {repos.length > 0 ? (
                        repos.map((repo) => (
                          <button
                            key={repo.full_name}
                            onClick={() => {
                              setRepoUrl(repo.url);
                              setWorkspaceName(repo.name);
                              setBaseBranch(repo.default_branch || "main");
                              setIsBrowsingRepos(false);
                              setError("");
                              void fetchBranches(repo.url);
                            }}
                            className="w-full text-left px-4 py-3 rounded-[6px] hover:bg-[#1A1C20] transition-colors group flex items-center justify-between"
                          >
                            <div className="flex flex-col">
                              <span className="text-[14px] text-[#D1D3D8] group-hover:text-white transition-colors flex items-center gap-2">
                                <FolderTree className="w-4 h-4 text-[#5E626B]" />
                                {repo.full_name}
                              </span>
                              {repo.description && (
                                <span className="text-[12px] text-[#5E626B] truncate max-w-[400px] pl-6">
                                  {repo.description}
                                </span>
                              )}
                            </div>
                            <ExternalLink className="w-3.5 h-3.5 text-[#2D3035] group-hover:text-[#5E626B] transition-colors" />
                          </button>
                        ))
                      ) : (
                        <div className="py-20 text-center text-[#5E626B] text-[13px] italic">
                          No repositories found.
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex flex-col gap-2">
                      <label className="text-[13px] font-medium text-[#D1D3D8]">
                        Repository Source
                      </label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <input
                            type="text"
                            value={repoUrl}
                            readOnly
                            onClick={handleBrowseRepos}
                            placeholder="Click to select a repository..."
                            className="w-full bg-[#16181A] border border-[#232529] rounded-[6px] py-2.5 px-4 text-[13px] text-[#F2F2F2] cursor-pointer hover:bg-[#1A1C20] hover:border-[#444853] transition-all outline-none text-left"
                          />
                          {repoUrl && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            </div>
                          )}
                        </div>
                        <button
                          onClick={handleBrowseRepos}
                          disabled={isLoadingRepos}
                          className="bg-[#1A1C20] hover:bg-[#232529] text-[#EBEBEB] border border-[#232529] text-[13px] font-medium px-4 py-2 rounded-[6px] transition-colors flex items-center gap-2"
                        >
                          {isLoadingRepos ? (
                            <Loader2 className="w-4 h-4 animate-spin text-[#5E626B]" />
                          ) : (
                            <Github className="w-4 h-4 text-[#5E626B]" />
                          )}
                          {repoUrl ? "Change Repository" : "Browse Repos"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </section>

              {/* Workspace Details Section */}
              <section className="space-y-6 pt-6 border-t border-white/5">
                <div className="border-b border-white/5 pb-2">
                  <h2 className="text-[18px] font-medium text-[#F2F2F2] mb-1">
                    Configuration
                  </h2>
                  <p className="text-[13px] text-[#8A8F98]">
                    Choose which branch to fork from. Orkestrate creates a
                    dedicated branch for this workspace.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-8">
                  <div className="flex flex-col gap-2">
                    <label className="text-[13px] font-medium text-[#D1D3D8]">
                      Workspace Name
                    </label>
                    <input
                      type="text"
                      value={workspaceName}
                      onChange={(e) => setWorkspaceName(e.target.value)}
                      placeholder="e.g. Acme Backend"
                      className="bg-[#16181A] border border-[#232529] rounded-[6px] py-2.5 px-4 text-[13px] text-[#F2F2F2] focus:outline-none focus:border-[#444853] focus:bg-[#1A1C20] transition-all outline-none"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-[13px] font-medium text-[#D1D3D8]">
                      Base Branch
                    </label>
                    <div className="relative">
                      <select
                        value={baseBranch}
                        onChange={(e) => setBaseBranch(e.target.value)}
                        disabled={isLoadingBranches || !repoUrl}
                        className="w-full bg-[#16181A] border border-[#232529] rounded-[6px] py-2.5 px-4 text-[13px] text-[#F2F2F2] appearance-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:border-[#444853] focus:bg-[#1A1C20] transition-all outline-none"
                      >
                        {!repoUrl && (
                          <option value="">Select a repo first</option>
                        )}
                        {isLoadingBranches ? (
                          <option>Loading branches...</option>
                        ) : branches.length > 0 ? (
                          branches.map((b) => (
                            <option
                              key={b.name}
                              value={b.name}
                              className="bg-[#1A1C20]"
                            >
                              {b.name}
                            </option>
                          ))
                        ) : (
                          repoUrl && <option>{baseBranch}</option>
                        )}
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5E626B] pointer-events-none" />
                    </div>
                  </div>
                </div>
              </section>

              {error && (
                <div className="p-4 bg-red-500/5 border border-red-500/10 rounded-[8px] flex items-center gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]" />
                  <span className="text-[13px] text-[#FF9E9E]">{error}</span>
                </div>
              )}

              <div className="pt-10 flex items-center justify-end gap-4 border-t border-white/5">
                <Link
                  href="/dashboard"
                  className="text-[13px] text-[#8A8F98] hover:text-[#D1D3D8] transition-colors font-medium px-4"
                >
                  Cancel
                </Link>
                <button
                  onClick={handleCreate}
                  disabled={isCreating || !repoUrl}
                  className="bg-[#EBEBEB] text-[#111214] hover:bg-white disabled:opacity-20 disabled:cursor-not-allowed text-[14px] font-bold px-8 py-2.5 rounded-[6px] transition-all active:scale-[0.98] shadow-lg shadow-white/5 flex items-center gap-2"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating Workspace...
                    </>
                  ) : (
                    <>
                      Create Workspace
                      <Plus className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
