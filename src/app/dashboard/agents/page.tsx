"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
    Search,
    MoreHorizontal,
    Activity,
    Terminal,
    Cpu,
    Clock,
    Laptop,
    Server,
    Filter,
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";
import useSWR from "swr";

const fetcher = (url: string) => {
    const supabase = createSupabaseBrowserClient();
    return supabase.auth.getSession().then(({ data: { session } }) => {
        return fetch(url, {
            headers: { Authorization: `Bearer ${session?.access_token}` },
        }).then((res) => res.json());
    });
};

type Room = {
    id: string;
    isActive?: boolean;
    repoUrl?: string | null;
};

type DashboardAgent = {
    stateClientId: string;
    clientBaseId: string;
    agentId: string;
    displayName: string;
    status: "online" | "offline" | "disconnected";
    lastPingAt: string;
    agentProfile: string;
    currentObjective: string;
    pluginConnected?: boolean;
    activeSessionId?: string | null;
    canViewChat?: boolean;
    codebaseMatch?: "matched" | "mismatch" | "unknown";
};

type AgentCard = {
    id: string;
    name: string;
    tool: string;
    status: "active" | "idle" | "offline";
    type: "local" | "team";
    host: string;
    task: string;
    uptime: string;
    memoryUsage: string;
    avatarUrl: string;
    codebaseMatch: "matched" | "mismatch" | "unknown";
    pluginConnected: boolean;
    canViewChat: boolean;
};

const AVATAR_POOL = [
    "https://images.unsplash.com/photo-1531427186611-ecfd6d936c79?w=64&h=64&fit=crop&crop=faces&auto=format&q=80",
    "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=64&h=64&fit=crop&crop=entropy&auto=format&q=80",
    "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=64&h=64&fit=crop&crop=faces&auto=format&q=80",
    "https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=64&h=64&fit=crop&crop=faces&auto=format&q=80",
    "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=64&h=64&fit=crop&crop=faces&auto=format&q=80",
];

function getToolName(agent: DashboardAgent): string {
    const profile = agent.agentProfile || "";
    if (/codex/i.test(profile) || /codex/i.test(agent.agentId)) return "Codex";
    if (/claude/i.test(profile) || /claude/i.test(agent.agentId)) return "Claude Code";
    if (/cursor/i.test(profile) || /cursor/i.test(agent.agentId)) return "Cursor";
    if (/opencode/i.test(profile) || /open/i.test(agent.agentId)) return "OpenCode";
    return "Unknown Tool";
}

function toCard(agent: DashboardAgent, roomId: string | null, idx: number): AgentCard {
    const name = agent.displayName || agent.agentId || "Unknown Agent";
    const status: AgentCard["status"] =
        agent.status === "online" ? "active" : agent.status === "offline" ? "idle" : "offline";
    const type: AgentCard["type"] = agent.clientBaseId.startsWith("local_") ? "local" : "team";
    const lastPing = new Date(agent.lastPingAt);
    const uptime = Number.isFinite(lastPing.getTime())
        ? `${Math.max(1, Math.round((Date.now() - lastPing.getTime()) / 60000))}m ago`
        : "--";

    return {
        id: agent.stateClientId,
        name,
        tool: getToolName(agent),
        status,
        type,
        host: roomId ? `Room ${roomId}` : "Current workspace",
        task: agent.currentObjective || "Waiting for assignment",
        uptime,
        memoryUsage: "--",
        avatarUrl: AVATAR_POOL[idx % AVATAR_POOL.length],
        codebaseMatch: agent.codebaseMatch || "unknown",
        pluginConnected: Boolean(agent.pluginConnected),
        canViewChat: Boolean(agent.canViewChat),
    };
}

export default function AgentsDirectoryPage() {
    const [tab, setTab] = useState<"All" | "Local" | "Team">("All");
    const [searchQuery, setSearchQuery] = useState("");

    const { data: wsData, error: wsError } = useSWR("/api/workspaces", fetcher, { refreshInterval: 5000 });
    const rooms: Room[] = Array.isArray(wsData?.rooms) ? wsData.rooms : [];
    const activeRoom = rooms.find((r) => r.isActive) || rooms[0] || null;
    const activeRoomId = activeRoom?.id || null;
    const isRepoLinked = Boolean(activeRoom?.repoUrl);

    const { data: contentData, error: contentError, isLoading: contentLoading } = useSWR(activeRoomId ? `/api/room-content?workspaceId=${encodeURIComponent(activeRoomId)}` : null, fetcher, { refreshInterval: 5000 });
    const agents: DashboardAgent[] = Array.isArray(contentData?.agents) ? contentData.agents : [];

    const loading = (!wsData && !wsError) || contentLoading;
    const error = wsError || contentError;

    const cards = useMemo(() => {
        return agents.map((agent, idx) => toCard(agent, activeRoomId, idx));
    }, [agents, activeRoomId]);

    const filteredAgents = useMemo(() => {
        return cards.filter((agent) => {
            if (tab === "Local" && agent.type !== "local") return false;
            if (tab === "Team" && agent.type !== "team") return false;
            if (
                searchQuery &&
                !`${agent.name} ${agent.tool} ${agent.task}`.toLowerCase().includes(searchQuery.toLowerCase())
            ) {
                return false;
            }
            return true;
        });
    }, [cards, tab, searchQuery]);

    return (
        <div className="h-full w-full bg-[#111214] text-[#EBEBEB] font-sans flex flex-col">
            <div className="px-8 py-5 border-b border-[#232529] flex items-center justify-between shrink-0 bg-[#111214]/80 backdrop-blur-md sticky top-0 z-10">
                <div className="flex items-center gap-6">
                    <h1 className="text-[15px] font-semibold tracking-tight text-[#F2F2F2]">Agents</h1>

                    <div className="flex items-center gap-1">
                        {["All", "Local", "Team"].map((t) => (
                            <button
                                key={t}
                                onClick={() => setTab(t as "All" | "Local" | "Team")}
                                className={`px-2.5 py-1 text-[13px] rounded-[6px] transition-colors font-medium ${tab === t
                                    ? "bg-[#232529] text-[#F2F2F2]"
                                    : "text-[#8A8F98] hover:text-[#D1D3D8] hover:bg-white/[0.04]"
                                    }`}
                            >
                                {t === "Local" ? "My Local Agents" : t === "Team" ? "Team Agents" : "All Agents"}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8A8F98]" />
                        <input
                            type="text"
                            placeholder="Find agent..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-[#1A1C20] border border-[#2A2D32] rounded-[6px] py-1.5 pl-8 pr-3 text-[13px] text-[#F2F2F2] placeholder:text-[#5E626B] focus:outline-none focus:border-[#444853] focus:bg-[#232529] w-48 transition-colors shadow-inner"
                        />
                    </div>
                    <button className="p-1.5 text-[#8A8F98] hover:text-[#F2F2F2] hover:bg-[#232529] rounded-[6px] transition-colors" title="Filter options">
                        <Filter className="w-4 h-4" />
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto w-full max-w-6xl mx-auto py-8 px-8">
                {!isRepoLinked && activeRoomId && (
                    <div className="mb-6 bg-amber-500/10 border border-amber-500/20 rounded-[10px] p-4 flex items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                                <Terminal className="w-4 h-4 text-amber-500" />
                            </div>
                            <div>
                                <h3 className="text-[13px] font-semibold text-amber-200">Repository Required</h3>
                                <p className="text-[12px] text-amber-200/70 mt-0.5">
                                    Agent coordination is disabled until a repository is linked to this room.
                                </p>
                            </div>
                        </div>
                        <Link
                            href="/dashboard/settings"
                            className="px-3 py-1.5 bg-amber-500 text-black text-[12px] font-semibold rounded-[6px] hover:bg-amber-400 transition-colors"
                        >
                            Connect Repository
                        </Link>
                    </div>
                )}

                {loading ? (
                    <div className="text-[13px] text-[#8A8F98]">Loading agents...</div>
                ) : error ? (
                    <div className="text-[13px] text-rose-400">{error}</div>
                ) : filteredAgents.length === 0 ? (
                    <div className="text-[13px] text-[#8A8F98]">
                        {activeRoomId ? "No agents found for this workspace." : "No active workspace found."}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

                        {filteredAgents.map((agent) => {
                            const canOpenChatCard = agent.canViewChat && agent.tool !== "OpenCode";
                            const cardClassName = `bg-[#16181A] border border-[#232529] rounded-[10px] shadow-sm transition-all duration-200 group flex flex-col relative overflow-hidden ${canOpenChatCard
                                ? "hover:border-[#33363D] hover:bg-[#1A1C20] cursor-pointer"
                                : "opacity-80"
                                }`;

                            const cardInner = (
                                <div className="p-5 flex items-start gap-4">
                                    <div className="relative shrink-0 mt-0.5">
                                        <img
                                            src={agent.avatarUrl}
                                            alt={agent.name}
                                            className="w-12 h-12 rounded-full object-cover shadow-sm border border-white/5"
                                        />
                                        <div className={`absolute -bottom-0.5 -right-0.5 w-[14px] h-[14px] rounded-full border-2 border-[#16181A] group-hover:border-[#1A1C20] flex items-center justify-center transition-colors ${agent.status === "active" ? "bg-[#3FB950]" :
                                            agent.status === "idle" ? "bg-[#D29922]" :
                                                "bg-[#8A8F98]"
                                            }`} />
                                    </div>

                                    <div className="flex-1 min-w-0 flex flex-col pt-0.5">
                                        <div className="flex items-start justify-between gap-3 mb-1">
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-2">
                                                    <span className={`font-semibold text-[14px] text-[#F2F2F2] ${canOpenChatCard ? "hover:underline underline-offset-2 decoration-[#373737]" : ""}`}>
                                                        {agent.name}
                                                    </span>
                                                    <span className="text-[#8A8F98]">·</span>
                                                    <div className="flex items-center gap-1.5 text-[12px] text-[#8A8F98]">
                                                        <Terminal className="w-3 h-3" />
                                                        <span>{agent.tool}</span>
                                                    </div>
                                                    {!canOpenChatCard && (
                                                        <span className="text-[10px] bg-[#232529] text-[#8A8F98] px-1.5 py-0.5 rounded-[4px] font-medium tracking-tight uppercase border border-[#2A2D32]">
                                                            Coordination Only
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="flex items-center gap-1.5 text-[13px] text-[#D1D3D8] mt-1.5">
                                                    {agent.status === "active" ? (
                                                        <Activity className="w-3.5 h-3.5 text-[#5E6AD2]" />
                                                    ) : (
                                                        <div className="w-1.5 h-1.5 rounded-full bg-[#8A8F98] ml-1 mr-0.5" />
                                                    )}
                                                    <span className="truncate">{agent.task}</span>
                                                </div>
                                                {!agent.pluginConnected && agent.tool !== "Claude Code" && agent.tool !== "OpenCode" && (
                                                    <div className="mt-2 text-[11px] text-amber-300/90">
                                                        Plugin not connected. Ask this agent to run <span className="font-mono">setup orkestrate</span> and restart session.
                                                    </div>
                                                )}
                                            </div>

                                            <button className="p-1 text-[#8A8F98] hover:text-[#F2F2F2] hover:bg-[#2A2D32] rounded-[4px] opacity-0 group-hover:opacity-100 transition-all shrink-0">
                                                <MoreHorizontal className="w-4 h-4" />
                                            </button>
                                        </div>

                                        <div className="flex items-center gap-5 mt-4 text-[12px] text-[#8A8F98] font-medium border-t border-[#232529]/50 pt-3">
                                            <div className="flex items-center gap-1.5 truncate" title="Source">
                                                {agent.type === "local" ? (
                                                    <Laptop className="w-3.5 h-3.5 shrink-0 text-[#A1A1A1]" />
                                                ) : (
                                                    <Server className="w-3.5 h-3.5 shrink-0 text-[#A1A1A1]" />
                                                )}
                                                <span className="truncate">{agent.host}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5" title="Last Seen">
                                                <Clock className="w-3.5 h-3.5 text-[#A1A1A1]" /> {agent.uptime}
                                            </div>
                                            <div
                                                className={`px-2 py-0.5 rounded-[999px] border text-[10px] uppercase tracking-wide ${agent.codebaseMatch === "matched"
                                                    ? "border-emerald-500/40 text-emerald-300 bg-emerald-500/10"
                                                    : agent.codebaseMatch === "mismatch"
                                                        ? "border-rose-500/40 text-rose-300 bg-rose-500/10"
                                                        : "border-[#2A2D32] text-[#8A8F98] bg-[#1A1C20]"
                                                    }`}
                                                title="Codebase match status"
                                            >
                                                {agent.codebaseMatch}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );

                            if (canOpenChatCard) {
                                return (
                                    <Link
                                        key={agent.id}
                                        href={`/dashboard/agent-chat/${encodeURIComponent(agent.name)}`}
                                        className={cardClassName}
                                    >
                                        {cardInner}
                                    </Link>
                                );
                            }

                            return (
                                <div key={agent.id} className={cardClassName}>
                                    {cardInner}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
