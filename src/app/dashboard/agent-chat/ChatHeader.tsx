"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { DashboardAgent, SessionRecord } from "./types";

interface ChatHeaderProps {
    selectedAgent: DashboardAgent | null;
    activeSession: SessionRecord | null;
    activeSessionNum: number | null;
    onBackToSessions: () => void;
}

export function ChatHeader({ selectedAgent, activeSession, activeSessionNum, onBackToSessions }: ChatHeaderProps) {
    return (
        <div className="px-8 py-5 border-b border-[#232529] flex items-center justify-between sticky top-0 bg-[#111214]/80 backdrop-blur-md z-10">
            <div className="flex items-center gap-2 text-[14px]">
                <Link href="/dashboard/agents" className="text-[#8A8F98] hover:text-[#F2F2F2] transition-colors">
                    Agents
                </Link>
                <ChevronRight className="w-3.5 h-3.5 text-[#5E626B]" />

                {activeSession ? (
                    <>
                        <button onClick={onBackToSessions} className="text-[#8A8F98] hover:text-[#F2F2F2] transition-colors truncate max-w-[180px]">
                            {selectedAgent?.displayName || "Agent"}
                        </button>
                        <ChevronRight className="w-3.5 h-3.5 text-[#5E626B]" />
                        <span className="font-semibold text-[#F2F2F2] truncate max-w-[200px]">
                            {activeSession.title || `Session ${activeSessionNum}`}
                        </span>
                    </>
                ) : (
                    <span className="font-semibold text-[#F2F2F2]">{selectedAgent?.displayName || "Agent"}</span>
                )}

                <div className="h-4 w-px bg-[#232529] mx-2" />
                <span className="text-[#8A8F98] text-[13px] truncate max-w-sm">
                    {selectedAgent?.currentObjective || "Standing by..."}
                </span>
            </div>
        </div>
    );
}
