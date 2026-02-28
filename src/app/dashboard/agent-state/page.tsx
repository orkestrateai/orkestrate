"use client";

import React, { useState } from 'react';
import {
    ChevronDown,
    RefreshCw,
    Terminal,
    Cpu,
    Database,
    Clock,
    Shield,
    FileJson,
    ListTree,
    AlertTriangle,
} from 'lucide-react';

import useSWR from 'swr';
import { createSupabaseBrowserClient } from '@/utils/supabase/client';

const fetcher = (url: string) => {
    const supabase = createSupabaseBrowserClient();
    return supabase.auth.getSession().then(({ data: { session } }) => {
        return fetch(url, {
            headers: { Authorization: `Bearer ${session?.access_token}` },
        }).then((res) => res.json());
    });
};

export default function AgentStateRegistryPage() {
    const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'Raw JSON' | 'Parsed Tree'>('Raw JSON');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    const { data: wsData } = useSWR("/api/workspaces", fetcher);
    const rooms = Array.isArray(wsData?.rooms) ? wsData.rooms : [];
    const activeRoomId = rooms.find((r: any) => r.isActive)?.id || rooms[0]?.id || null;

    const { data: roomData, mutate } = useSWR(activeRoomId ? `/api/room-content?workspaceId=${activeRoomId}` : null, fetcher, {
        refreshInterval: 5000 // Poll every 5s for live state
    });

    const agents = Array.isArray(roomData?.agents) ? roomData.agents : [];
    const recentActivity = Array.isArray(roomData?.recentActivity) ? roomData.recentActivity : [];
    const recentConflicts = Array.isArray(roomData?.recentConflicts) ? roomData.recentConflicts : [];
    const resolvedSelectedAgentId =
        selectedAgentId && agents.some((agent: any) => agent.stateClientId === selectedAgentId)
            ? selectedAgentId
            : (agents[0]?.stateClientId ?? null);
    const selectedAgent = agents.find((a: any) => a.stateClientId === resolvedSelectedAgentId) || agents[0];
    const selectedAgentActivity = selectedAgent
        ? recentActivity
            .filter((event: any) => event.scopedAgentId === selectedAgent.stateClientId)
            .slice(0, 30)
        : [];
    const selectedAgentConflicts = selectedAgent
        ? recentConflicts
            .filter((event: any) => {
                const conflictingId =
                    typeof event?.payload?.conflictingScopedAgentId === "string"
                        ? event.payload.conflictingScopedAgentId
                        : null;
                return (
                    event.scopedAgentId === selectedAgent.stateClientId ||
                    conflictingId === selectedAgent.stateClientId
                );
            })
            .slice(0, 20)
        : [];

    const formatTimeAgo = (dateStr: string) => {
        if (!dateStr) return "never";
        const parsed = new Date(dateStr);
        return Number.isNaN(parsed.getTime()) ? "unknown" : parsed.toLocaleTimeString();
    };

    return (
        <div className="h-full w-full bg-[#111214] text-[#EBEBEB] font-sans flex flex-col">

            {/* Header: Agent Selector */}
            <div className="px-8 py-5 border-b border-[#232529] flex items-center justify-between shrink-0 bg-[#16181A]">
                <div className="flex items-center gap-4">
                    <h1 className="text-[16px] font-semibold tracking-tight text-[#F2F2F2]">State Registry</h1>
                    <div className="h-4 w-[1px] bg-[#232529] mx-2"></div>

                    {/* Real Agent Dropdown */}
                    <div className="relative">
                        <button
                            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                            className="flex items-center gap-2 bg-[#1A1C20] hover:bg-[#232529] border border-[#2A2D32] px-3 py-1.5 rounded-[6px] transition-colors shadow-sm"
                        >
                            <div className={`w-2 h-2 rounded-full ${selectedAgent?.status === 'online' ? 'bg-[#3FB950]' : 'bg-[#5E626B]'}`} />
                            <span className="text-[13px] font-medium text-[#F2F2F2]">
                                {selectedAgent?.displayName || "Select Agent..."}
                            </span>
                            <ChevronDown className="w-3.5 h-3.5 text-[#8A8F98] ml-1" />
                        </button>

                        {isDropdownOpen && (
                            <div className="absolute top-full left-0 mt-1 w-64 bg-[#111214] border border-[#232529] rounded-[8px] shadow-xl z-50 p-1 overflow-y-auto max-h-64">
                                {agents.map((a: any) => (
                                    <button
                                        key={a.stateClientId}
                                        onClick={() => {
                                            setSelectedAgentId(a.stateClientId);
                                            setIsDropdownOpen(false);
                                        }}
                                        className="w-full flex items-center gap-3 px-3 py-2 text-[13px] hover:bg-[#1A1C20] rounded-[6px] text-left text-[#8A8F98] hover:text-[#F2F2F2] transition-colors"
                                    >
                                        <div className={`w-2 h-2 rounded-full shrink-0 ${a.status === 'online' ? 'bg-[#3FB950]' : 'bg-[#5E626B]'}`} />
                                        <div className="flex flex-col truncate">
                                            <span className="font-medium truncate">{a.displayName}</span>
                                            <span className="text-[11px] opacity-60 truncate">{a.agentId}</span>
                                        </div>
                                    </button>
                                ))}
                                {agents.length === 0 && (
                                    <div className="px-3 py-4 text-center text-[#5E626B] text-[12px]">No active agents</div>
                                )}
                            </div>
                        )}
                    </div>

                    <span className="text-[12px] text-[#8A8F98] flex items-center gap-1.5 ml-2">
                        <Terminal className="w-3.5 h-3.5" />
                        {selectedAgent?.agentId.split('::')[0] || "Orkestrate"}
                    </span>
                </div>

                <div className="flex items-center gap-3 text-[13px] text-[#8A8F98]">
                    <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        Last synced {formatTimeAgo(selectedAgent?.lastPingAt)}
                    </span>
                    <button
                        onClick={() => void mutate()}
                        className="flex items-center gap-1.5 hover:text-[#F2F2F2] transition-colors ml-2 bg-[#1A1C20] hover:bg-[#232529] border border-[#2A2D32] px-2.5 py-1.5 rounded-[6px] shadow-sm"
                    >
                        <RefreshCw className="w-3 h-3" />
                        Refresh
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">

                {/* Left Panel: Metrics & Quick Info */}
                <div className="w-full lg:w-[320px] bg-[#111214] border-r border-[#232529] p-6 flex flex-col gap-6 overflow-y-auto shrink-0">

                    {!selectedAgent ? (
                        <div className="text-center py-12 text-[#5E626B] text-[13px]">No agent selected</div>
                    ) : (
                        <>
                            <div>
                                <h3 className="text-[11px] font-semibold text-[#5E626B] uppercase tracking-wider mb-4">Runtime Metrics</h3>
                                <div className="space-y-3.5">
                                    <MetricRow icon={Database} label="Last Ping" value={formatTimeAgo(selectedAgent.lastPingAt)} />
                                    <MetricRow
                                        icon={Cpu}
                                        label="Status"
                                        value={selectedAgent.status}
                                        valueColor={selectedAgent.status === 'online' ? "text-[#3FB950]" : "text-[#8A8F98]"}
                                    />
                                    <MetricRow icon={Clock} label="Objective" value={selectedAgent.currentObjective} />
                                    <MetricRow
                                        icon={Shield}
                                        label="Codebase"
                                        value={selectedAgent.codebaseMatch || "unknown"}
                                        valueColor={
                                            selectedAgent.codebaseMatch === 'matched'
                                                ? "text-[#3FB950]"
                                                : selectedAgent.codebaseMatch === 'mismatch'
                                                    ? "text-[#E5534B]"
                                                    : "text-[#8A8F98]"
                                        }
                                    />
                                </div>
                            </div>

                            <div className="h-[1px] bg-[#232529] w-full" />

                            <div>
                                <h3 className="text-[11px] font-semibold text-[#5E626B] uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <Shield className="w-3.5 h-3.5" />
                                    Internal Profile
                                </h3>
                                <div className="text-[13px] text-[#8A8F98] leading-relaxed bg-[#16181A] p-3 rounded-[8px] border border-[#232529]">
                                    {selectedAgent.agentProfile}
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Right Panel: State JSON Viewer */}
                <div className="flex-1 bg-[#1A1C20] flex flex-col relative overflow-hidden">

                    {/* View Tabs */}
                    <div className="absolute top-4 right-6 flex bg-[#111214] rounded-[6px] p-0.5 border border-[#232529] shadow-sm z-10">
                        {['Raw JSON', 'Parsed Tree'].map(t => (
                            <button
                                key={t}
                                onClick={() => setActiveTab(t as any)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 text-[12px] rounded-[4px] transition-colors ${activeTab === t
                                    ? 'bg-[#232529] text-[#F2F2F2] shadow-sm font-medium'
                                    : 'text-[#8A8F98] hover:text-[#D1D3D8]'
                                    }`}
                            >
                                {t === 'Raw JSON' ? <FileJson className="w-3.5 h-3.5" /> : <ListTree className="w-3.5 h-3.5" />}
                                {t}
                            </button>
                        ))}
                    </div>

                    {/* Editor Area */}
                    <div className="flex-1 overflow-auto p-6 pt-16 font-mono text-[13px] leading-relaxed relative selection:bg-[#5E6AD2]/30 selection:text-[#F2F2F2]">
                        <div className="mb-5 rounded-[8px] border border-[#232529] bg-[#111214] p-4">
                            <div className="text-[11px] uppercase tracking-wider text-[#5E626B] mb-3 font-sans font-medium">
                                Live Activity
                            </div>
                            {selectedAgentActivity.length === 0 ? (
                                <div className="text-[12px] text-[#5E626B]">No recent observed edits or commits.</div>
                            ) : (
                                <div className="space-y-2">
                                    {selectedAgentActivity.map((event: any) => (
                                        <div key={event.id} className="text-[12px] text-[#A1A6B4] border-b border-[#1A1C20] pb-2">
                                            <div className="text-[#D1D3D8] font-medium">{event.eventType}</div>
                                            <div className="text-[#8A8F98]">
                                                {new Date(event.createdAt).toLocaleTimeString()}
                                            </div>
                                            <pre className="whitespace-pre-wrap text-[#8A8F98] mt-1">
                                                {JSON.stringify(event.payload, null, 2)}
                                            </pre>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="mb-5 rounded-[8px] border border-[#3B2A2A] bg-[#1C1414] p-4">
                            <div className="text-[11px] uppercase tracking-wider text-[#B57B7B] mb-3 font-sans font-medium flex items-center gap-2">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                Conflict Alerts
                            </div>
                            {selectedAgentConflicts.length === 0 ? (
                                <div className="text-[12px] text-[#8A6B6B]">No recent conflict alerts.</div>
                            ) : (
                                <div className="space-y-2">
                                    {selectedAgentConflicts.map((event: any) => (
                                        <div key={event.id} className="text-[12px] text-[#D4B4B4] border-b border-[#2A1D1D] pb-2">
                                            <div className="text-[#E7C1C1] font-medium">{event.eventType}</div>
                                            <div className="text-[#A88383]">
                                                {new Date(event.createdAt).toLocaleTimeString()}
                                            </div>
                                            <pre className="whitespace-pre-wrap text-[#B89090] mt-1">
                                                {JSON.stringify(event.payload, null, 2)}
                                            </pre>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="absolute left-0 top-0 bottom-0 w-12 bg-[#1A1C20] border-r border-[#232529] text-right py-16 pr-3 text-[#5E626B] select-none pointer-events-none text-[12px]">
                            {Array.from({ length: 100 }).map((_, i) => (
                                <div key={i} className="leading-relaxed">{i + 1}</div>
                            ))}
                        </div>

                        <div className="pl-10">
                            {selectedAgent ? (
                                <pre className="text-[#D1D3D8]">
                                    {JSON.stringify(selectedAgent.stateContent, null, 2)}
                                </pre>
                            ) : (
                                <div className="text-[#5E626B]">No data available</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function MetricRow({ icon: Icon, label, value, valueColor = "text-[#D1D3D8]" }: { icon: any, label: string, value: string, valueColor?: string }) {
    return (
        <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-[13px] text-[#8A8F98]">
                <Icon className="w-4 h-4 text-[#5E626B]" />
                {label}
            </span>
            <span className={`text-[13px] font-medium ${valueColor}`}>{value}</span>
        </div>
    );
}

