"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Session } from "@supabase/supabase-js";
import { Search, Plus, FolderKanban, Globe, Lock, Github } from "lucide-react";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";
import Link from "next/link";

type Workspace = {
  id: string;
  name: string;
  isActive: boolean;
  repoUrl?: string;
  description?: string;
  updatedAt: string;
};

function QuickstartCard() {
  return (
    <div className="flex items-center justify-center py-8">
      <div className="w-full max-w-2xl">
        <div className="relative border border-white/[0.06] rounded-2xl p-8 overflow-hidden bg-gradient-to-b from-white/[0.02] to-transparent">
          {/* Subtle grid background */}
          <div className="absolute inset-0 opacity-[0.2] pointer-events-none">
            <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern
                  id="iso-pattern"
                  width="28"
                  height="24"
                  patternUnits="userSpaceOnUse"
                >
                  <path
                    d="M14 0 L28 8 L28 16 L14 24 L0 16 L0 8 Z"
                    fill="none"
                    stroke="white"
                    strokeWidth="0.5"
                  />
                  <path d="M14 24 L14 48" stroke="white" strokeWidth="0.5" />
                  <path
                    d="M0 16 L-14 24 M28 16 L42 24"
                    stroke="white"
                    strokeWidth="0.5"
                  />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#iso-pattern)" />
            </svg>
          </div>

          <div className="relative">
            <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-6 font-medium">
              Quickstart
            </div>

            {/* Step-by-step flow */}
            <div className="space-y-6">
              {/* Step 1 */}
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-white/[0.08] border border-white/10 flex items-center justify-center text-[10px] font-mono text-zinc-400">
                  1
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-zinc-200 mb-2">
                    Install the Orkestrate CLI
                  </p>
                  <code className="block text-[11px] font-mono text-zinc-400 bg-black/40 border border-white/[0.06] rounded-lg px-3 py-2">
                    bun install -g orkestrate
                  </code>
                  <p className="text-[11px] text-zinc-600 mt-2">
                    Requires Bun runtime. Run once to install globally.
                  </p>
                </div>
              </div>

              {/* Arrow */}
              <div className="flex justify-center ml-8">
                <svg
                  className="w-4 h-4 text-zinc-700"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M19 14l-7 7m0 0l-7-7m7 7V3"
                  />
                </svg>
              </div>

              {/* Step 2 */}
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-white/[0.08] border border-white/10 flex items-center justify-center text-[10px] font-mono text-zinc-400">
                  2
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-zinc-200 mb-2">
                    Authenticate with Orkestrate + GitHub
                  </p>
                  <code className="block text-[11px] font-mono text-zinc-400 bg-black/40 border border-white/[0.06] rounded-lg px-3 py-2">
                    orkestrate login
                  </code>
                  <p className="text-[11px] text-zinc-600 mt-2">
                    Opens browser for Orkestrate OAuth (identity) and GitHub
                    OAuth (repo access). Both are required to create workspaces.
                  </p>
                </div>
              </div>

              {/* Arrow */}
              <div className="flex justify-center ml-8">
                <svg
                  className="w-4 h-4 text-zinc-700"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M19 14l-7 7m0 0l-7-7m7 7V3"
                  />
                </svg>
              </div>

              {/* Step 3 */}
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-white/[0.08] border border-white/10 flex items-center justify-center text-[10px] font-mono text-zinc-400">
                  3
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-zinc-200 mb-2">
                    Initialize your project
                  </p>
                  <code className="block text-[11px] font-mono text-zinc-400 bg-black/40 border border-white/[0.06] rounded-lg px-3 py-2">
                    orkestrate init
                  </code>
                  <p className="text-[11px] text-zinc-600 mt-2">
                    Run from your project directory. Detects your git context
                    and creates a workspace bound to your repository.
                  </p>
                </div>
              </div>

              {/* Arrow */}
              <div className="flex justify-center ml-8">
                <svg
                  className="w-4 h-4 text-zinc-700"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M19 14l-7 7m0 0l-7-7m7 7V3"
                  />
                </svg>
              </div>

              {/* Step 4 */}
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-white/[0.08] border border-white/10 flex items-center justify-center text-[10px] font-mono text-zinc-400">
                  4
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-zinc-200 mb-2">
                    Connect your AI tool
                  </p>
                  <code className="block text-[11px] font-mono text-zinc-400 bg-black/40 border border-white/[0.06] rounded-lg px-3 py-2">
                    orkestrate connect claude
                  </code>
                  <p className="text-[11px] text-zinc-600 mt-2">
                    Configures Claude Code to use Orkestrate as an MCP server.
                    Supports claude, opencode, cursor, windsurf, and codex.
                  </p>
                </div>
              </div>

              {/* Arrow */}
              <div className="flex justify-center ml-8">
                <svg
                  className="w-4 h-4 text-zinc-700"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M19 14l-7 7m0 0l-7-7m7 7V3"
                  />
                </svg>
              </div>

              {/* Step 5 */}
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-white/[0.08] border border-white/10 flex items-center justify-center text-[10px] font-mono text-zinc-400">
                  5
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-zinc-200 mb-2">
                    Call join_workspace in your AI tool
                  </p>
                  <code className="block text-[11px] font-mono text-zinc-400 bg-black/40 border border-white/[0.06] rounded-lg px-3 py-2 mb-2">
                    join_workspace &lt;workspace_id&gt;
                  </code>
                  <p className="text-[11px] text-zinc-500">
                    Once Claude Code is running, call join_workspace with your
                    workspace ID to connect your agent. Find your workspace ID
                    in the dashboard or run orkestrate status.
                  </p>
                  <div className="p-3 rounded-lg bg-black/60 border border-white/[0.04] mt-3">
                    <p className="text-[10px] text-zinc-600 mb-1.5 uppercase tracking-wider">
                      What happens next:
                    </p>
                    <ul className="space-y-1 text-[11px] text-zinc-400">
                      <li className="flex items-center gap-2">
                        <span className="text-zinc-600">→</span>
                        Your agent registers in your workspace
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-zinc-600">→</span>
                        Scope claims prevent file collisions
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-zinc-600">→</span>
                        Other agents become visible to collaborate
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* CLI commands summary */}
            <div className="mt-8 pt-6 border-t border-white/[0.06]">
              <p className="text-[10px] uppercase tracking-widest text-zinc-600 mb-3 font-medium">
                Two Commands to Remember
              </p>
              <div className="grid grid-cols-2 gap-3">
                <code className="block text-[11px] font-mono text-zinc-300 bg-black/40 border border-white/[0.06] rounded-lg px-3 py-2">
                  orkestrate login
                </code>
                <code className="block text-[11px] font-mono text-zinc-300 bg-black/40 border border-white/[0.06] rounded-lg px-3 py-2">
                  orkestrate init
                </code>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptySearchState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
      <div className="w-16 h-16 rounded-full bg-white/[0.02] border border-white/5 flex items-center justify-center">
        <FolderKanban className="w-8 h-8 text-zinc-700" />
      </div>
      <div>
        <p className="text-sm font-medium text-zinc-400">No workspaces found</p>
        <p className="text-xs text-zinc-600 mt-1">
          Try a different search or create a new one
        </p>
      </div>
    </div>
  );
}

function ZedSpinner({ size = "24px" }: { size?: string }) {
  return (
    <div className="flex items-center justify-center">
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        className="animate-spin text-zinc-600"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="2"
          strokeDasharray="2 6" // This creates the "dotted" effect
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

export default function DashboardPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isInitialLoading, setIsInitialLoading] = useState(true); // Outer global loading
  const [isRefreshing, setIsRefreshing] = useState(false); // Inner list loading
  const [session, setSession] = useState<any>(null);

  // Initialize once
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  // 1. Handle Auth State
  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data: { session } }: { data: { session: Session | null } }) => {
        setSession(session);
        if (!session) setIsInitialLoading(false); // Stop loading if no user is found
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event: string, session: Session | null) => {
        setSession(session);
        if (!session) setIsInitialLoading(false);
      },
    );

    return () => subscription.unsubscribe();
  }, [supabase]);

  // 2. Handle Data Fetching
  useEffect(() => {
    if (!session) return;

    const loadWorkspaces = async () => {
      setIsRefreshing(true);
      try {
        const res = await fetch("/api/workspaces", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setWorkspaces(data.workspaces || []);
        }
      } catch (error) {
        console.error("Failed to fetch workspaces", error);
      } finally {
        setIsRefreshing(false);
        setIsInitialLoading(false); // Only turns off once on first mount
      }
    };

    loadWorkspaces();
  }, [session]);

  const filteredWorkspaces = workspaces.filter((ws) =>
    ws.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  function timeAgo(date: string) {
    if (!date) return "Unknown";
    const d = new Date(date);
    if (isNaN(d.getTime())) return "Unknown";

    const now = new Date();
    const diff = Math.floor((now.getTime() - d.getTime()) / 1000);

    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
    return `${Math.floor(diff / 86400)} days ago`;
  }

  // 3. Render: Initial Page Load Spinner
  if (isInitialLoading) {
    return (
      <div className="flex-1 bg-[#050505] min-h-screen flex items-center justify-center">
        <ZedSpinner size="32px" />
      </div>
    );
  }

  // 4. Render: Unauthenticated State
  if (!session) {
    return (
      <div className="flex-1 bg-[#050505] min-h-screen">
        <div className="max-w-4xl mx-auto px-8 pt-16">
          <div className="flex flex-col items-center justify-center py-24 gap-6 text-center">
            <div className="w-16 h-16 rounded-full bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
              <FolderKanban className="w-8 h-8 text-zinc-700" />
            </div>
            <div>
              <p className="text-lg font-medium text-zinc-300 mb-1">
                Sign in to continue
              </p>
              <p className="text-sm text-zinc-600">
                Connect your GitHub account to create workspaces and
                collaborate.
              </p>
            </div>
            <button
              onClick={() => {
                supabase.auth.signInWithOAuth({
                  provider: "github",
                  options: {
                    redirectTo: window.location.origin + "/dashboard",
                  },
                });
              }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white text-black text-sm font-medium hover:bg-zinc-200 transition-colors"
            >
              <Github className="w-4 h-4" />
              Sign in with GitHub
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 5. Render: Authenticated Dashboard
  return (
    <div className="flex-1 bg-[#050505] min-h-screen">
      <div className="max-w-4xl mx-auto px-8 pt-16 pb-24">
        {workspaces.length > 0 ? (
          <>
            <div className="flex items-center justify-between mb-10">
              <h1 className="text-2xl font-semibold text-white tracking-tight">
                Your Workspaces
              </h1>
              <Link
                href="/dashboard/workspaces/new"
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/10 text-sm font-medium text-zinc-300 hover:bg-white/[0.08] hover:text-white transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>New workspace</span>
              </Link>
            </div>

            <div className="relative mb-8 group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-zinc-600 group-focus-within:text-zinc-400 transition-colors" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search your workspaces..."
                className="w-full bg-white/[0.02] border border-white/5 rounded-xl py-3 pl-12 pr-4 text-[14px] text-white placeholder:text-zinc-600 focus:outline-none focus:border-white/10 focus:bg-white/[0.04] transition-all"
              />
            </div>

            <div className="space-y-6">
              <div className="flex items-center gap-4 px-2">
                <span className="text-[12px] font-bold text-zinc-600 uppercase tracking-widest">
                  All Workspaces
                </span>
                {/* Inner spinner displays during background fetching */}
                {isRefreshing && <ZedSpinner size="16px" />}
              </div>

              <div className="relative space-y-1">
                {/* Optional subtle fade when list is refreshing */}
                {isRefreshing && (
                  <div className="absolute inset-0 bg-[#050505]/20 z-10 pointer-events-none" />
                )}

                {filteredWorkspaces.length > 0 ? (
                  filteredWorkspaces.map((ws) => (
                    <Link
                      key={ws.id}
                      href={`/dashboard/workspaces/${ws.id}`}
                      className="group flex flex-col p-4 rounded-xl hover:bg-white/[0.03] transition-all border border-transparent hover:border-white/5"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-3">
                          <h3 className="text-[16px] font-medium text-zinc-100 group-hover:text-white transition-colors">
                            {ws.name}
                          </h3>
                          {ws.repoUrl ? (
                            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/5 text-[10px] font-medium text-zinc-500">
                              <Lock className="w-2.5 h-2.5" />
                              <span>Git Bound</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-zinc-900 text-[10px] font-medium text-zinc-600">
                              <Globe className="w-2.5 h-2.5" />
                              <span>Sandbox</span>
                            </div>
                          )}
                        </div>
                        <span className="text-[12px] text-zinc-600 font-medium">
                          Last modified {timeAgo(ws.updatedAt)}
                        </span>
                      </div>
                      {ws.description && (
                        <p className="text-[13px] text-zinc-500 line-clamp-1 truncate max-w-2xl">
                          {ws.description}
                        </p>
                      )}
                    </Link>
                  ))
                ) : (
                  <EmptySearchState />
                )}
              </div>
            </div>
          </>
        ) : (
          <QuickstartCard />
        )}
      </div>
    </div>
  );
}
