"use client";

import { useState } from "react";

import { Suggestion } from "@/components/ai-elements/suggestion";

import { Terminal, Bot, Code2, Paperclip, ArrowUp } from "lucide-react";

import { OpenCodeRenderer } from "@/components/chat-renderers/OpenCodeRenderer";
import { CodexRenderer } from "@/components/chat-renderers/CodexRenderer";
import { ClaudeRenderer } from "@/components/chat-renderers/ClaudeRenderer";
import { openCodeMockParts, codexMockItems, claudeMockLog } from "./mock-data";

const AGENTS = {
    alpha: {
        name: "Alpha",
        tool: "OpenCode",
        Icon: Terminal,
        avatarUrl: "https://images.unsplash.com/photo-1531427186611-ecfd6d936c79?w=32&h=32&fit=crop&crop=faces&auto=format&q=80",
        status: "bg-[#5E626B]",
        statusText: "Idle — Waiting for input"
    },
    bravo: {
        name: "Bravo",
        tool: "Codex",
        Icon: Bot,
        avatarUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=32&h=32&fit=crop&crop=entropy&auto=format&q=80",
        status: "bg-[#D29922]",
        statusText: "Active — Running tests"
    },
    charlie: {
        name: "Charlie",
        tool: "Claude Code",
        Icon: Code2,
        avatarUrl: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=32&h=32&fit=crop&crop=faces&auto=format&q=80",
        status: "bg-[#3FB950] shadow-[0_0_8px_rgba(63,185,80,0.4)]",
        statusText: "Active — Analyzing codebase"
    }
};

export default function AgentChatView() {
    const [activeTab, setActiveTab] = useState<"alpha" | "bravo" | "charlie">("alpha");
    const currentAgent = AGENTS[activeTab];

    return (
        <div className="flex h-full w-full bg-[#111214] text-[#F2F2F2] font-sans">
            {/* Right Panel - Chat Stream (Demoing ai-elements) */}
            <div className="flex-1 flex flex-col relative w-full pt-16">

                {/* Header Overlay */}
                <div className="absolute top-0 left-0 right-0 h-16 border-b border-[#232529] flex items-center px-8 shrink-0 bg-[#16181A]/80 backdrop-blur-md z-10 w-full transition-all duration-300 shadow-sm">
                    <img
                        src={currentAgent.avatarUrl}
                        alt={currentAgent.name}
                        className="w-8 h-8 rounded-full object-cover mr-4 shadow-sm border border-[#232529]"
                    />
                    <div>
                        <h1 className="font-semibold text-[#F2F2F2] flex items-center gap-2 text-[15px]">
                            {currentAgent.name}
                            <span className="px-2 py-0.5 rounded-[4px] bg-[#1A1C20] text-[10px] uppercase tracking-wider text-[#8A8F98] border border-[#2A2D32] shadow-inner">{currentAgent.tool}</span>
                        </h1>
                        <p className="text-[12px] text-[#8A8F98] flex items-center gap-1.5 mt-0.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${currentAgent.status}`}></span> {currentAgent.statusText}
                        </p>
                    </div>
                </div>

                {/* Stream */}
                <div className="flex-1 overflow-y-auto p-8 pt-6 pb-32 bg-[#111214] w-full">
                    <div className="max-w-4xl mx-auto space-y-8 pb-12">
                        {activeTab === "alpha" && <OpenCodeRenderer parts={openCodeMockParts} />}
                        {activeTab === "bravo" && <CodexRenderer events={codexMockItems} />}
                        {activeTab === "charlie" && <ClaudeRenderer items={claudeMockLog} />}
                    </div>
                </div>

                {/* Input Area Overlay */}
                {(activeTab === "alpha" || activeTab === "charlie") && (
                    <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-[#111214] via-[#111214]/95 to-transparent w-full z-10 flex flex-col items-center justify-end gap-3 pointer-events-none">
                        <div className="max-w-4xl w-full mx-auto flex gap-3 pointer-events-auto px-4">
                            <Suggestion suggestion="What's the status of the auth refactor?" />
                            <Suggestion suggestion="Cancel current task" />
                        </div>

                        {/* Prompt Input Area */}
                        <div className="max-w-4xl w-full mx-auto px-4 pointer-events-auto">
                            <div className="relative flex items-center bg-[#1A1C20] border border-[#2A2D32] rounded-xl p-2 shadow-sm transition-colors focus-within:border-[#444853] focus-within:bg-[#232529]">
                                {/* Attach button */}
                                <button className="p-2 text-[#8A8F98] hover:text-[#D1D3D8] hover:bg-[#2A2D32] rounded-lg transition-colors flex-shrink-0" aria-label="Attach file">
                                    <Paperclip className="w-5 h-5" />
                                </button>

                                {/* Input field */}
                                <input
                                    type="text"
                                    placeholder={`Message ${currentAgent.name}...`}
                                    className="flex-1 bg-transparent border-none text-[15px] text-[#F2F2F2] placeholder:text-[#5E626B] focus:outline-none px-3 py-2 min-w-0"
                                />

                                {/* Send button */}
                                <button
                                    className="p-2 ml-2 bg-[#F2F2F2] text-[#111214] rounded-lg hover:bg-white transition-colors flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                                    aria-label="Send prompt"
                                >
                                    <ArrowUp className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="text-center mt-2.5">
                                <span className="text-[11px] text-[#5E626B]">
                                    Orkestrate may make mistakes. Please verify critical changes.
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

