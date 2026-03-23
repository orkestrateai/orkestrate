"use client";

import { useParams } from "next/navigation";
import useSWR from "swr";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";
import { Bot, Loader2, GitBranch, ChevronLeft, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

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

async function deleteAgent(
  agentId: string,
  workspaceId: string,
): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const res = await fetch(
    `/api/workspaces/${workspaceId}/agents?agentId=${agentId}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${session?.access_token}` },
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Failed to delete agent");
  }
}

const statusStyles: Record<string, { bg: string; text: string; dot: string }> =
  {
    active: {
      bg: "bg-emerald-500/10",
      text: "text-emerald-400",
      dot: "bg-emerald-400",
    },
    idle: { bg: "bg-zinc-500/10", text: "text-zinc-400", dot: "bg-zinc-500" },
    blocked: { bg: "bg-red-500/10", text: "text-red-400", dot: "bg-red-400" },
  };

function getStatusStyle(s: string) {
  return statusStyles[s] ?? statusStyles.idle;
}

export default function AgentsPage() {
  const { id } = useParams<{ id: string }>();
  const [selectedAgent, setSelectedAgent] = useState<AgentData | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<AgentData | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const {
    data: agents,
    error,
    isLoading,
  } = useSWR(id ? `/api/workspaces/${id}/agents` : null, agentsFetcher, {
    refreshInterval: 5000,
  });

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen bg-black gap-3">
        <Loader2 className="w-5 h-5 animate-spin text-zinc-600" />
        <span className="text-sm text-zinc-500">Loading agents...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen bg-black p-8 text-center">
        <h1 className="text-base font-medium text-white mb-1">
          Failed to load
        </h1>
        <p className="text-sm text-zinc-500 mb-4">{error.message}</p>
        <Link
          href={`/dashboard/workspaces/${id}`}
          className="text-sm text-zinc-400 hover:text-white"
        >
          ← Return to Workspace
        </Link>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-screen relative overflow-hidden">
      <div className="max-w-5xl mx-auto px-6 pt-20 pb-24 relative z-10">
        {/* Header */}
        <div className="mb-8">
          <Link
            href={`/dashboard/workspaces/${id}`}
            className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors mb-6"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </Link>

          <div className="flex items-end justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-white tracking-tight">
                Agents
              </h1>
              <p className="text-sm text-zinc-500 mt-1">
                {agents?.length ?? 0} agent{agents?.length !== 1 ? "s" : ""}{" "}
                connected
              </p>
            </div>
          </div>
        </div>

        {/* Agents Grid */}
        {agents && agents.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {agents.map((agent, i) => (
              <motion.button
                key={agent.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => setSelectedAgent(agent)}
                className="p-4 rounded-lg border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/10 transition-all text-left"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-md bg-white/5 flex items-center justify-center">
                      <Bot className="w-4 h-4 text-zinc-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">
                        {agent.agentId}
                      </p>
                      <p className="text-xs text-zinc-600">{agent.toolName}</p>
                    </div>
                  </div>
                  <div
                    className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full ${getStatusStyle(agent.status).bg}`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${getStatusStyle(agent.status).dot}`}
                    />
                    <span
                      className={`text-xs ${getStatusStyle(agent.status).text}`}
                    >
                      {agent.status}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-zinc-500 line-clamp-2">
                  {agent.objective}
                </p>
                {agent.branch && (
                  <div className="flex items-center gap-1.5 mt-2 text-xs text-zinc-600">
                    <GitBranch className="w-3 h-3" />
                    <span>{agent.branch}</span>
                  </div>
                )}
              </motion.button>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mb-4">
              <Bot className="w-5 h-5 text-zinc-600" />
            </div>
            <h3 className="text-sm font-medium text-white mb-1">No agents</h3>
            <p className="text-xs text-zinc-500 max-w-xs">
              Connect agents to this workspace via MCP to see them here.
            </p>
          </div>
        )}
      </div>

      {/* Right Panel */}
      <AnimatePresence>
        {selectedAgent && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedAgent(null)}
              className="fixed inset-0 bg-black/40 z-40"
            />

            {/* Panel */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 400, damping: 35 }}
              className="fixed inset-y-0 right-0 w-full max-w-md bg-[#0a0a0a] border-l border-white/5 z-50 flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-5 border-b border-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center">
                    <Bot className="w-4 h-4 text-zinc-400" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-white">
                      {selectedAgent.agentId}
                    </h2>
                    <p className="text-xs text-zinc-500">
                      {selectedAgent.toolName}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedAgent(null)}
                  className="text-zinc-500 hover:text-white text-lg leading-none px-1"
                >
                  ×
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {/* Status */}
                <div>
                  <p className="text-xs text-zinc-500 mb-1.5">Status</p>
                  <div
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ${getStatusStyle(selectedAgent.status).bg}`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${getStatusStyle(selectedAgent.status).dot}`}
                    />
                    <span
                      className={`text-xs ${getStatusStyle(selectedAgent.status).text}`}
                    >
                      {selectedAgent.status}
                    </span>
                  </div>
                </div>

                {/* Objective */}
                <div>
                  <p className="text-xs text-zinc-500 mb-1.5">
                    Current Objective
                  </p>
                  <p className="text-sm text-zinc-300">
                    {selectedAgent.objective}
                  </p>
                </div>

                {/* Branch */}
                {selectedAgent.branch && (
                  <div>
                    <p className="text-xs text-zinc-500 mb-1.5">Branch</p>
                    <div className="flex items-center gap-2 text-sm text-zinc-300">
                      <GitBranch className="w-3.5 h-3.5" />
                      <span>{selectedAgent.branch}</span>
                      {selectedAgent.headSha && (
                        <span className="text-xs text-zinc-600 font-mono">
                          {selectedAgent.headSha.slice(0, 7)}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Footprint */}
                {selectedAgent.footprint.length > 0 && (
                  <div>
                    <p className="text-xs text-zinc-500 mb-2">Files</p>
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
                    <p className="text-xs text-zinc-500 mb-2">Plan</p>
                    <ul className="space-y-1.5">
                      {selectedAgent.plan.map((step, idx) => (
                        <li
                          key={idx}
                          className="text-sm text-zinc-400 flex gap-2"
                        >
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
                    <p className="text-xs text-zinc-500 mb-2">Completed</p>
                    <ul className="space-y-1.5">
                      {selectedAgent.completed.map((item, idx) => (
                        <li
                          key={idx}
                          className="text-sm text-zinc-500 flex gap-2"
                        >
                          <span className="text-emerald-600">✓</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Notes */}
                {selectedAgent.notes && (
                  <div>
                    <p className="text-xs text-zinc-500 mb-1.5">Notes</p>
                    <p className="text-sm text-zinc-400 whitespace-pre-wrap">
                      {selectedAgent.notes}
                    </p>
                  </div>
                )}

                {/* Last Activity */}
                <div>
                  <p className="text-xs text-zinc-500 mb-1.5">Last Activity</p>
                  <p className="text-xs text-zinc-600">
                    {new Date(selectedAgent.lastMessageAt).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div className="p-5 border-t border-white/5">
                <button
                  onClick={() => setDeleteConfirm(selectedAgent)}
                  className="w-full px-4 py-2.5 text-sm text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/10 transition-colors flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Remove Agent
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Delete Dialog */}
      <Dialog
        open={!!deleteConfirm}
        onOpenChange={() => setDeleteConfirm(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Agent?</DialogTitle>
            <DialogDescription>
              This will disconnect{" "}
              <span className="text-foreground font-medium">
                {deleteConfirm?.agentId}
              </span>{" "}
              from the workspace.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirm(null)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (!deleteConfirm) return;
                setIsDeleting(true);
                try {
                  await deleteAgent(deleteConfirm.id, id);
                  setDeleteConfirm(null);
                  setSelectedAgent(null);
                } catch (err) {
                  alert(
                    err instanceof Error
                      ? err.message
                      : "Failed to remove agent",
                  );
                } finally {
                  setIsDeleting(false);
                }
              }}
              disabled={isDeleting}
            >
              {isDeleting ? "Removing..." : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
