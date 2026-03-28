"use client";

import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";
import {
  Bot,
  BookOpen,
  Loader2,
  GitBranch,
  ChevronLeft,
  Users,
  Settings,
  Lock,
  Globe,
} from "lucide-react";
import Link from "next/link";

interface WorkspaceData {
  id: string;
  name: string;
  repoUrl: string | null;
  defaultBranch: string | null;
  baseBranch: string;
  maxAgents: number;
  maxMembers: number;
  role: string;
}

interface AgentData {
  id: string;
  agentId: string;
  toolName: string;
  status: string;
  objective: string;
  footprint: string[];
  plan: string[];
  completed: string[];
  notes: string;
  branch: string | null;
  headSha: string | null;
  lastMessageAt: string;
  updatedAt: string;
}

interface MemberData {
  id: string;
  userId: string;
  role: string;
  isCurrentUser: boolean;
  displayName: string;
  email: string;
  avatarUrl: string;
  joinedAt: string;
}

async function workspaceFetcher(url: string): Promise<WorkspaceData> {
  const supabase = createSupabaseBrowserClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${session?.access_token}` },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Failed to load workspace");
  }

  const data = await res.json();
  return data.workspace as WorkspaceData;
}

async function agentsFetcher(url: string): Promise<AgentData[]> {
  const supabase = createSupabaseBrowserClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${session?.access_token}` },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Failed to load agents");
  }

  const data = await res.json();
  return data.agents as AgentData[];
}

async function membersFetcher(url: string): Promise<MemberData[]> {
  const supabase = createSupabaseBrowserClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${session?.access_token}` },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Failed to load members");
  }

  const data = await res.json();
  return data.members as MemberData[];
}

export default function WorkspaceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const {
    data: workspace,
    error,
    isLoading,
  } = useSWR(id ? `/api/workspaces/${id}` : null, workspaceFetcher, {
    onError: (err: any) => {
      if (err.message === "Unauthorized" || err.message === "unauthorized") {
        router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
      }
    },
  });

  const {
    data: agents,
    error: agentsError,
    isLoading: agentsLoading,
  } = useSWR(id ? `/api/workspaces/${id}/agents` : null, agentsFetcher, {
    refreshInterval: 5000,
  });

  const {
    data: members,
    error: membersError,
    isLoading: membersLoading,
  } = useSWR(id ? `/api/workspace-members?workspaceId=${id}` : null, membersFetcher);

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#050505] min-h-screen gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-700" />
        <span className="text-sm text-zinc-500">Loading workspace...</span>
      </div>
    );
  }

  if (error || !workspace) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#050505] min-h-screen p-8 text-center">
        <h1 className="text-lg font-semibold text-white mb-2">
          {error?.message ?? "Workspace not found"}
        </h1>
        <p className="text-sm text-zinc-500 mb-6">
          This workspace does not exist or you don&apos;t have access to it.
        </p>
        <Link
          href="/dashboard"
          className="text-sm text-zinc-400 hover:text-white transition-colors"
        >
          ← Return to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-[#050505] min-h-screen">
      <div className="max-w-4xl mx-auto px-8 pt-16 pb-24">
        {/* Header */}
        <div className="mb-10">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-white transition-colors mb-6"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-white tracking-tight mb-2">
                {workspace.name}
              </h1>
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-zinc-600 uppercase tracking-widest">
                  {workspace.role}
                </span>
                {workspace.repoUrl ? (
                  <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                    <GitBranch className="w-3 h-3" />
                    <span>
                      {workspace.repoUrl.split("/").pop()?.replace(".git", "")}
                    </span>
                    {workspace.defaultBranch && (
                      <span className="text-zinc-600">
                        ({workspace.defaultBranch})
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-xs text-zinc-600">
                    <Globe className="w-3 h-3" />
                    Sandbox
                  </div>
                )}
              </div>
            </div>

            <Link
              href={`/dashboard/workspaces/${workspace.id}/settings`}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/10 text-sm font-medium text-zinc-400 hover:bg-white/[0.07] hover:text-white transition-all"
            >
              <Settings className="w-4 h-4" />
              Settings
            </Link>
          </div>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            href={`/dashboard/workspaces/${workspace.id}/knowledge-base`}
            className="group p-6 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 hover:bg-white/[0.04] transition-all flex flex-col"
          >
            <div className="w-10 h-10 rounded-xl bg-white/[0.04] flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
              <BookOpen className="w-5 h-5 text-zinc-400" />
            </div>
            <h3 className="text-base font-semibold text-zinc-100 group-hover:text-white transition-colors mb-1">
              Knowledge Base
            </h3>
            <p className="text-sm text-zinc-500">
              Shared documentation and context for agents.
            </p>
          </Link>

          <Link
            href={`/dashboard/workspaces/${workspace.id}/agents`}
            className="group p-6 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 hover:bg-white/[0.04] transition-all flex flex-col"
          >
            <div className="w-10 h-10 rounded-xl bg-white/[0.04] flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
              <Bot className="w-5 h-5 text-zinc-400" />
            </div>
            <h3 className="text-base font-semibold text-zinc-100 group-hover:text-white transition-colors mb-1">
              Agents
            </h3>
            <p className="text-sm text-zinc-500">
              {agents?.length || 0} / {workspace.maxAgents} active agents
            </p>
          </Link>

          <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col">
            <div className="flex items-center justify-between mb-5">
              <div className="w-10 h-10 rounded-xl bg-white/[0.04] flex items-center justify-center">
                <Users className="w-5 h-5 text-zinc-400" />
              </div>
              <div className="flex -space-x-2">
                {members?.slice(0, 3).map((m) => (
                  <div key={m.id} className="w-6 h-6 rounded-full border border-[#050505] overflow-hidden bg-zinc-800">
                    {m.avatarUrl ? (
                      <img src={m.avatarUrl} alt={m.displayName} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-zinc-500">
                        {m.displayName?.[0]}
                      </div>
                    )}
                  </div>
                ))}
                {(members?.length || 0) > 3 && (
                  <div className="w-6 h-6 rounded-full border border-[#050505] bg-zinc-900 flex items-center justify-center text-[9px] font-bold text-zinc-500">
                    +{(members?.length || 0) - 3}
                  </div>
                )}
              </div>
            </div>
            <h3 className="text-base font-semibold text-zinc-100 mb-1">
              Members
            </h3>
            <p className="text-sm text-zinc-500">
              {members?.length || 0} / {workspace.maxMembers} seats occupied.
            </p>
          </div>
        </div>

        {/* Repo binding prompt */}
        {!workspace.repoUrl && (
          <div className="mt-8 p-5 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Lock className="w-4 h-4 text-zinc-600" />
              <p className="text-sm text-zinc-500">
                No repository bound — this is a sandbox workspace.
              </p>
            </div>
            <Link
              href={`/dashboard/workspaces/${workspace.id}/settings`}
              className="text-sm text-zinc-400 hover:text-white transition-colors font-medium"
            >
              Bind a repo →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
