import React from 'react';
import { Bot, ChevronLeft, ChevronRight, Activity } from "lucide-react";
import { CodexRenderer } from './CodexRenderer';

interface AgentTelemetryPaneProps {
    chatFeed: any[];
    telemetryLogs: { timestamp: string; clientId: string; agent: string; message: string; event: string }[];
    activeAgentsList: { id: string; clientId: string; agent: string; name: string; lastMessage: string; lastUpdate: string; status: 'online' | 'offline' | 'disconnected' }[];
    selectedAgentId: string | null;
    setSelectedAgentId: (id: string | null) => void;
    terminalRef: React.RefObject<HTMLDivElement | null>;
}

export function AgentTelemetryPane({
    chatFeed,
    telemetryLogs,
    activeAgentsList,
    selectedAgentId,
    setSelectedAgentId,
    terminalRef
}: AgentTelemetryPaneProps) {

    // Filter raw logs for the selected agent
    const selectedAgentLogs = selectedAgentId
        ? telemetryLogs.filter(log => `${log.clientId}-${log.agent}` === selectedAgentId)
        : [];

    // Determine if the selected agent is a Codex agent
    const selectedAgent = activeAgentsList.find((a: any) => a.id === selectedAgentId);
    const isCodexAgent = selectedAgent?.name?.toLowerCase().includes('codex');

    return (
        <div className="flex flex-col h-full bg-black/40 relative z-10 overflow-hidden">
            {/* Header */}
            <header className="h-[56px] flex-shrink-0 border-b border-white/[0.06] px-6 flex items-center bg-black/40 z-20 backdrop-blur-md">
                {selectedAgentId ? (
                    <button onClick={() => setSelectedAgentId(null)} className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                        <ChevronLeft className="w-4 h-4" />
                        <span>Agents</span>
                        <ChevronRight className="w-3.5 h-3.5 opacity-40 mx-1" />
                        <span className="text-foreground">{selectedAgent?.name}</span>
                    </button>
                ) : (
                    <h1 className="text-sm font-medium text-foreground flex items-center gap-2">
                        <Activity className="w-4 h-4 text-primary" />
                        Active Agents
                    </h1>
                )}
            </header>

            {/* Content Area */}
            <div className={`flex-1 overflow-hidden flex flex-col ${!selectedAgentId ? 'p-6' : ''}`}>
                {!selectedAgentId ? (
                    // MASTER VIEW — Agent cards list
                    <div className="h-full overflow-y-auto scroll-smooth custom-scrollbar">
                        {activeAgentsList.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-muted-foreground/50 text-sm space-y-4">
                                <Bot className="w-10 h-10 opacity-20" />
                                <p>No agents currently active in this workspace.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-4">
                                {activeAgentsList.map((agent: any) => (
                                    <div
                                        key={agent.id}
                                        onClick={() => setSelectedAgentId(agent.id)}
                                        className="group cursor-pointer rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 hover:bg-white/[0.05] hover:border-white/[0.1] transition-all"
                                    >
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
                                                    <Bot className="w-4 h-4 text-primary" />
                                                </div>
                                                <span className="font-medium text-foreground">{agent.name}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {agent.status === 'online' ? (
                                                    <div className="flex items-center gap-1.5 text-[10px] font-medium tracking-wider uppercase text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full border border-emerald-400/20">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></div>
                                                        Online
                                                    </div>
                                                ) : agent.status === 'disconnected' ? (
                                                    <div className="flex items-center gap-1.5 text-[10px] font-medium tracking-wider uppercase text-red-400 bg-red-400/10 px-2 py-0.5 rounded-full border border-red-400/20">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-red-400"></div>
                                                        Disconnected
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-1.5 text-[10px] font-medium tracking-wider uppercase text-zinc-400 bg-zinc-400/10 px-2 py-0.5 rounded-full border border-zinc-400/20">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-zinc-400"></div>
                                                        Offline
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <p className="text-sm text-muted-foreground line-clamp-2">
                                            {agent.lastMessage}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    // DETAIL VIEW — Scrollable logs
                    <div className="flex flex-col h-full bg-black/20">
                        {/* Scrollable Logs Area */}
                        <div className="flex-1 overflow-y-auto p-6 scroll-smooth custom-scrollbar">
                            {isCodexAgent ? (
                                <CodexRenderer logs={selectedAgentLogs} terminalRef={terminalRef} />
                            ) : (
                                <RawTelemetryView logs={selectedAgentLogs} terminalRef={terminalRef} />
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Fallback: Raw JSON View (for non-Codex agents) ──────────────
function RawTelemetryView({
    logs,
    terminalRef
}: {
    logs: { timestamp: string; clientId: string; agent: string; message: string; event: string }[];
    terminalRef: React.RefObject<HTMLDivElement | null>;
}) {
    return (
        <div className="space-y-2 pb-12">
            <div className="flex items-center justify-between mb-4">
                <span className="text-xs text-muted-foreground font-mono">
                    {logs.length} raw events
                </span>
            </div>

            {logs.map((log, idx) => {
                let parsedMessage: any = null;
                try {
                    parsedMessage = JSON.parse(log.message);
                } catch (e) { }

                const eventType = parsedMessage?.type || log.event || 'raw';

                const typeColors: Record<string, string> = {
                    'reasoning': 'text-blue-400 bg-blue-400/10 border-blue-400/20',
                    'tool': 'text-amber-400 bg-amber-400/10 border-amber-400/20',
                    'text': 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
                    'response_item': 'text-purple-400 bg-purple-400/10 border-purple-400/20',
                    'step-start': 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20',
                    'step-finish': 'text-rose-400 bg-rose-400/10 border-rose-400/20',
                    'system': 'text-zinc-400 bg-zinc-400/10 border-zinc-400/20',
                };

                const colorClass = typeColors[eventType] || 'text-gray-400 bg-gray-400/10 border-gray-400/20';

                return (
                    <details key={idx} className="group/event rounded-lg border border-white/[0.04] bg-white/[0.01] hover:bg-white/[0.03] transition-colors">
                        <summary className="flex items-center gap-3 px-3 py-2 cursor-pointer select-none list-none text-[12px]">
                            <span className="text-muted-foreground/40 font-mono shrink-0 w-8 text-right">{idx}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border ${colorClass}`}>
                                {eventType}
                            </span>
                            <span className="text-muted-foreground/50 font-mono text-[10px]">
                                {new Date(log.timestamp).toLocaleTimeString()}
                            </span>
                            <ChevronRight className="w-3 h-3 ml-auto text-muted-foreground/30 group-open/event:rotate-90 transition-transform" />
                        </summary>
                        <div className="px-3 pb-3 pt-1 border-t border-white/[0.04]">
                            <pre className="text-[11px] font-mono text-gray-300/80 whitespace-pre-wrap break-all leading-relaxed overflow-x-auto max-h-[400px] overflow-y-auto">
                                {parsedMessage
                                    ? JSON.stringify(parsedMessage, null, 2)
                                    : log.message
                                }
                            </pre>
                        </div>
                    </details>
                );
            })}
            <div ref={terminalRef} className="h-4"></div>
        </div>
    );
}
