"use client";

import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";
import {
  Bot,
  Loader2,
  GitBranch,
  ChevronLeft,
  X,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

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

export default function AgentsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [selectedAgent, setSelectedAgent] = useState<AgentData | null>(null);

  const {
    data: agents,
    error,
    isLoading,
  } = useSWR(id ? `/api/workspaces/${id}/agents` : null, agentsFetcher, {
    refreshInterval: 5000,
    onError: (err) => {
      if (err.message === "Unauthorized") router.push("/login");
    },
  });

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#050505] min-h-screen gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-700" />
        <span className="text-sm text-zinc-500">Loading agents...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#050505] min-h-screen p-8 text-center">
        <h1 className="text-lg font-semibold text-white mb-2">
          {error?.message ?? "Failed to load agents"}
        </h1>
        <p className="text-sm text-zinc-500 mb-6">
          Unable to fetch agents for this workspace.
        </p>
        <Link
          href={`/dashboard/workspaces/${id}`}
          className="text-sm text-zinc-400 hover:text-white transition-colors"
        >
          ← Return to Workspace
        </Link>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-[#050505] min-h-screen">
      <div className="max-w-6xl mx-auto px-8 pt-16 pb-24">
        {/* Header */}
        <div className="mb-10">
          <Link
            href={`/dashboard/workspaces/${id}`}
            className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-white transition-colors mb-6"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Workspace
          </Link>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-white tracking-tight mb-2">
                Active Agents
              </h1>
              <p className="text-sm text-zinc-500">
                {agents?.length || 0} agent{agents?.length !== 1 ? "s" : ""} currently active
              </p>
            </div>
          </div>
        </div>

        {/* Agents Grid */}
        {agents && agents.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {agents.map((agent) => (
              <button
                key={agent.id}
                onClick={() => setSelectedAgent(agent)}
                className="p-5 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 hover:bg-white/[0.04] transition-all text-left"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center">
                      <Bot className="w-4 h-4 text-zinc-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-zinc-100">
                        {agent.agentId}
                      </h3>
                      <p className="text-xs text-zinc-600">{agent.toolName}</p>
                    </div>
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      agent.status === "active"
                        ? "bg-green-500/10 text-green-400"
                        : agent.status === "idle"
                        ? "bg-zinc-500/10 text-zinc-400"
                        : agent.status === "blocked"
                        ? "bg-red-500/10 text-red-400"
                        : "bg-blue-500/10 text-blue-400"
                    }`}
                  >
                    {agent.status}
                  </span>
                </div>
                <p className="text-sm text-zinc-400 line-clamp-2 mb-3">
                  {agent.objective}
                </p>
                {agent.branch && (
                  <div className="flex items-center gap-1.5 text-xs text-zinc-600">
                    <GitBranch className="w-3 h-3" />
                    <span>{agent.branch}</span>
                  </div>
                )}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/[0.02] flex items-center justify-center mb-4">
              <Bot className="w-8 h-8 text-zinc-600" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">
              No active agents
            </h3>
            <p className="text-sm text-zinc-500 max-w-md">
              Connect agents to this workspace via MCP to see them here.
            </p>
          </div>
        )}

        {/* Side Panel */}
        {selectedAgent && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-end">
            <div className="w-full max-w-2xl h-full bg-[#0a0a0a] border-l border-white/10 overflow-y-auto">
              <div className="sticky top-0 bg-[#0a0a0a] border-b border-white/10 p-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-white/[0.04] flex items-center justify-center">
                    <Bot className="w-5 h-5 text-zinc-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white">
                      {selectedAgent.agentId}
                    </h2>
                    <p className="text-sm text-zinc-500">{selectedAgent.toolName}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedAgent(null)}
                  className="p-2 rounded-lg hover:bg-white/[0.04] transition-colors"
                >
                  <X className="w-5 h-5 text-zinc-400" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Status */}
                <div>
                  <h3 className="text-sm font-semibold text-zinc-400 mb-2">Status</h3>
                  <span
                    className={`inline-block text-sm px-3 py-1 rounded-full ${
                      selectedAgent.status === "active"
                        ? "bg-green-500/10 text-green-400"
                        : selectedAgent.status === "idle"
                        ? "bg-zinc-500/10 text-zinc-400"
                        : selectedAgent.status === "blocked"
                        ? "bg-red-500/10 text-red-400"
                        : "bg-blue-500/10 text-blue-400"
                    }`}
                  >
                    {selectedAgent.status}
                  </span>
                </div>

                {/* Current Objective */}
                <div>
                  <h3 className="text-sm font-semibold text-zinc-400 mb-2">
                    Current Objective
                  </h3>
                  <p className="text-sm text-zinc-300">{selectedAgent.objective}</p>
                </div>

                {/* Branch Info */}
                {selectedAgent.branch && (
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-400 mb-2">Branch</h3>
                    <div className="flex items-center gap-2 text-sm text-zinc-300">
                      <GitBranch className="w-4 h-4" />
                      <span>{selectedAgent.branch}</span>
                    </div>
                    {selectedAgent.headSha && (
                      <p className="text-xs text-zinc-600 mt-1 font-mono">
                        {selectedAgent.headSha.slice(0, 7)}
                      </p>
                    )}
                  </div>
                )}

                {/* Footprint */}
                {selectedAgent.footprint.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-400 mb-2">
                      Architecture Footprint
                    </h3>
                    <div className="space-y-1">
                      {selectedAgent.footprint.map((path, idx) => (
                        <div
                          key={idx}
                          className="text-xs text-zinc-500 font-mono bg-white/[0.02] px-2 py-1 rounded"
                        >
                          {path}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Plan */}
                {selectedAgent.plan.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-400 mb-2">
                      Implementation Plan
                    </h3>
                    <ul className="space-y-2">
                      {selectedAgent.plan.map((step, idx) => (
                        <li key={idx} className="text-sm text-zinc-300 flex gap-2">
                          <span className="text-zinc-600">{idx + 1}.</span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Completed */}
                {selectedAgent.completed.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-400 mb-2">
                      Completed Work
                    </h3>
                    <ul className="space-y-2">
                      {selectedAgent.completed.map((item, idx) => (
                        <li key={idx} className="text-sm text-zinc-500 flex gap-2">
                          <span className="text-zinc-700">✓</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Notes */}
                {selectedAgent.notes && (
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-400 mb-2">
                      Notes for Team
                    </h3>
                    <p className="text-sm text-zinc-400 whitespace-pre-wrap">
                      {selectedAgent.notes}
                    </p>
                  </div>
                )}

                {/* Last Activity */}
                <div>
                  <h3 className="text-sm font-semibold text-zinc-400 mb-2">
                    Last Activity
                  </h3>
                  <p className="text-sm text-zinc-500">
                    {new Date(selectedAgent.lastMessageAt).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
