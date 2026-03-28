"use client";

import React, { useEffect, useMemo, useState } from "react";
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

function EmptyWorkspaceCard() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-full max-w-2xl rounded-2xl border border-white/[0.08] bg-[#0a0a0b] p-8">
        <div className="mb-4 inline-flex items-center rounded-full border border-white/[0.08] bg-white/[0.02] px-3 py-1 text-[11px] font-medium tracking-wide text-zinc-400">
          No workspaces yet
        </div>
        <h2 className="text-2xl font-semibold tracking-tight text-zinc-100">
          Create a workspace to start coordinating agents
        </h2>
        <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-500">
          Workspaces isolate repositories, agent sessions, and MCP policy. Your
          onboarding is complete; now create a workspace for your next
          orchestration run.
        </p>
        <div className="mt-8 flex items-center gap-3">
          <Link
            href="/dashboard/workspaces/new"
            className="inline-flex items-center justify-center rounded-lg border border-white/[0.15] bg-white px-4 py-2.5 text-sm font-medium text-black transition-colors hover:bg-zinc-100"
          >
            Create workspace
          </Link>
          <Link
            href="/dashboard/settings"
            className="inline-flex items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.02] px-4 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-white/[0.05]"
          >
            Open settings
          </Link>
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
          strokeDasharray="2 6"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

export default function DashboardPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [session, setSession] = useState<Session | null>(null);

  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data: { session } }: { data: { session: Session | null } }) => {
        setSession(session);
        if (!session) {
          setIsInitialLoading(false);
        }
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event: string, currentSession: Session | null) => {
        setSession(currentSession);
        if (!currentSession) {
          setIsInitialLoading(false);
        }
      },
    );

    return () => subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (!session) {
      return;
    }

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
        setIsInitialLoading(false);
      }
    };

    void loadWorkspaces();
  }, [session]);

  const filteredWorkspaces = workspaces.filter((ws) =>
    ws.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const timeAgo = (date: string) => {
    if (!date) {
      return "Unknown";
    }

    const d = new Date(date);
    if (isNaN(d.getTime())) {
      return "Unknown";
    }

    const now = new Date();
    const diff = Math.floor((now.getTime() - d.getTime()) / 1000);

    if (diff < 60) {
      return "just now";
    }
    if (diff < 3600) {
      return `${Math.floor(diff / 60)} minutes ago`;
    }
    if (diff < 86400) {
      return `${Math.floor(diff / 3600)} hours ago`;
    }

    return `${Math.floor(diff / 86400)} days ago`;
  };

  if (isInitialLoading) {
    return (
      <div className="flex-1 bg-[#050505] min-h-screen flex items-center justify-center">
        <ZedSpinner size="32px" />
      </div>
    );
  }

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
                void supabase.auth.signInWithOAuth({
                  provider: "github",
                  options: {
                    redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/dashboard")}`,
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
                {isRefreshing ? <ZedSpinner size="16px" /> : null}
              </div>

              <div className="relative space-y-1">
                {isRefreshing ? (
                  <div className="absolute inset-0 bg-[#050505]/20 z-10 pointer-events-none" />
                ) : null}

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
                      {ws.description ? (
                        <p className="text-[13px] text-zinc-500 line-clamp-1 truncate max-w-2xl">
                          {ws.description}
                        </p>
                      ) : null}
                    </Link>
                  ))
                ) : (
                  <EmptySearchState />
                )}
              </div>
            </div>
          </>
        ) : (
          <EmptyWorkspaceCard />
        )}
      </div>
    </div>
  );
}
