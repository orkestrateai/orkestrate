import React from 'react';
import { FileText, Users, ChevronRight, Hash, EyeOff } from "lucide-react";

type SelectedAgentState = {
    stateClientId: string;
    agentId: string;
    displayName: string;
    status: 'online' | 'offline' | 'disconnected';
    lastPingAt: string | Date;
    stateMarkdown: string;
};

interface WorkspaceContentPaneProps {
    activeRoom: any;
    onlineAgentCount: number;
    totalAgentCount: number;
    lastUpdated: Date | null;
    overviewMarkdown: string;
    selectedAgentState: SelectedAgentState | null;
    onClearSelectedAgent: () => void;
}

export function WorkspaceContentPane({
    activeRoom,
    onlineAgentCount,
    totalAgentCount,
    lastUpdated,
    overviewMarkdown,
    selectedAgentState,
    onClearSelectedAgent,
}: WorkspaceContentPaneProps) {
    const content = selectedAgentState?.stateMarkdown || overviewMarkdown;
    const viewTitle = selectedAgentState ? `Agent State: ${selectedAgentState.agentId}` : 'Room Overview';

    return (
        <div className="flex flex-col h-full bg-black/20 relative z-0">
            {activeRoom ? (
                <>
                    <header className="h-[56px] flex-shrink-0 border-b border-white/[0.06] px-6 flex items-center justify-between bg-black/40 z-20 backdrop-blur-md">
                        <div className="flex items-center gap-4">
                            <h1 className="text-sm font-medium text-foreground flex items-center gap-2">
                                <FileText className="w-4 h-4 text-muted-foreground" />
                                <span className="hidden xl:inline">Shared Workspace</span>
                            </h1>
                            <span className="text-white/[0.1]">|</span>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium bg-black/50 px-3 py-1.5 rounded-md border border-white/[0.05]">
                                <Users className="w-3.5 h-3.5" />
                                <span className="hidden xl:inline">Online:</span>
                                <span className="text-foreground ml-1">{onlineAgentCount}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium bg-black/50 px-3 py-1.5 rounded-md border border-white/[0.05]">
                                <Users className="w-3.5 h-3.5" />
                                <span className="hidden xl:inline">Total:</span>
                                <span className="text-foreground ml-1">{totalAgentCount}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium bg-black/50 px-3 py-1.5 rounded-md border border-white/[0.05]">
                                <Hash className="w-3.5 h-3.5" />
                                <span className="hidden xl:inline">Room ID:</span>
                                <span className="text-foreground ml-1 font-mono">{activeRoom.id}</span>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            {selectedAgentState ? (
                                <button
                                    onClick={onClearSelectedAgent}
                                    className="inline-flex items-center gap-2 text-xs text-muted-foreground border border-white/[0.08] rounded-md px-2.5 py-1.5 hover:bg-white/[0.04] hover:text-foreground transition-colors"
                                >
                                    <EyeOff className="w-3.5 h-3.5" />
                                    Room Overview
                                </button>
                            ) : null}
                            {lastUpdated && (
                                <span className="text-xs text-muted-foreground flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/80 animate-pulse"></div>
                                    Synced
                                </span>
                            )}
                        </div>
                    </header>

                    <div className="flex-1 overflow-y-auto w-full p-4 lg:p-8 relative">
                        <div className="max-w-3xl mx-auto w-full h-[90%] min-h-[500px] rounded-xl border border-white/[0.08] bg-black/40 shadow-2xl overflow-hidden flex flex-col relative z-10 backdrop-blur-md">
                            <div className="h-10 border-b border-white/[0.06] bg-black/60 flex items-center px-4 gap-2 shrink-0">
                                <div className="flex gap-1.5">
                                    <div className="w-2.5 h-2.5 rounded-full bg-white/[0.15]"></div>
                                    <div className="w-2.5 h-2.5 rounded-full bg-white/[0.15]"></div>
                                    <div className="w-2.5 h-2.5 rounded-full bg-white/[0.15]"></div>
                                </div>
                                <div className="ml-4 flex items-center gap-2 text-[11px] font-mono text-muted-foreground bg-white/[0.03] border border-white/[0.05] px-2.5 py-1 rounded-md min-w-0">
                                    <span className="text-muted-foreground hidden sm:inline">workspace</span>
                                    <ChevronRight className="w-3.5 h-3.5 opacity-40 hidden sm:inline" />
                                    <span className="text-gray-300 truncate">{viewTitle}</span>
                                </div>
                            </div>

                            <div className="flex-1 p-6 font-mono text-sm leading-relaxed text-gray-300 bg-black/20 overflow-y-auto outline-none">
                                {!content ? (
                                    <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-70">
                                        <FileText className="w-10 h-10 text-muted-foreground/50" />
                                        <p className="text-muted-foreground text-sm max-w-xs">
                                            The workspace is empty. Connect an agent to begin drafting.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="whitespace-pre-wrap">{content}</div>
                                )}
                            </div>
                        </div>
                    </div>
                </>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-black z-20">
                    <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/[0.05] flex items-center justify-center mb-5">
                        <FileText className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-medium text-foreground">No Workspace Selected</h3>
                    <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
                        Select a room from the sidebar or create a new one to view the shared agent coordination file.
                    </p>
                </div>
            )}
        </div>
    );
}
