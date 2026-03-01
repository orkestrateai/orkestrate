"use client";

import { useEffect, useMemo, useRef } from "react";
import { ClaudeRenderer } from "@/components/chat-renderers/ClaudeRenderer";
import type { AgentFamily, ParsedEvent } from "./types";
import { formatTs } from "./utils";
import { toClaudeParts } from "./transforms";

interface ChatTranscriptProps {
    logs: ParsedEvent[];
    agentFamily: AgentFamily;
}

export function ChatTranscript({ logs, agentFamily }: ChatTranscriptProps) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const claudeParts = useMemo(() => (agentFamily === "claude" ? toClaudeParts(logs) : []), [logs, agentFamily]);

    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [claudeParts, logs]);

    return (
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-8 py-6 no-scrollbar">
            <div className="max-w-3xl mx-auto w-full space-y-6 pb-12">
                {agentFamily === "claude" ? (
                    <ClaudeRenderer items={claudeParts} />
                ) : (
                    <div className="space-y-4">
                        {logs.map((L, i) => (
                            <div key={i} className="p-4 border border-[#232529] rounded-xl bg-[#16181A]">
                                <div className="text-[11px] text-[#5E626B] mb-2">{formatTs(L.timestamp)}</div>
                                <pre className="text-[13px] text-[#F2F2F2] whitespace-pre-wrap font-mono uppercase opacity-80">{L.parsedType}</pre>
                                <div className="mt-2 text-[14px] leading-relaxed">
                                    {typeof L.payload === "string" ? L.payload : JSON.stringify(L.payload, null, 2)}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
