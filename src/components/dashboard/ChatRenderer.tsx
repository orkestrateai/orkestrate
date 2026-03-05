/**
 * ChatRenderer — Extracted chat bubble rendering component.
 * 
 * This is the ORIGINAL chat rendering logic, preserved as a reference
 * while we rebuild the session activity detail view with proper per-agent JSON handling.
 * 
 * Usage (when re-enabled):
 *   <ChatRenderer messages={filteredChatFeed} terminalRef={terminalRef} />
 */

import React from 'react';
import { Bot, Wrench, Brain, CheckCircle2, CircleDashed, ChevronRight, X } from "lucide-react";
import { marked } from 'marked';

interface ChatMessage {
    id: string;
    clientId: string;
    agent: string;
    timestamp: string;
    text?: string;
    reasoningChunks: { time: string, text: string }[];
    toolCalls: { id: string, name: string, input: any, output?: any, status: 'running' | 'completed' | 'error' }[];
}

interface ChatRendererProps {
    messages: ChatMessage[];
    terminalRef: React.RefObject<HTMLDivElement | null>;
}

export function ChatRenderer({ messages, terminalRef }: ChatRendererProps) {
    return (
        <div className="space-y-6 pb-12">
            {messages.map((msg, idx) => (
                <div key={idx} className="flex gap-4 group">
                    <div className="flex flex-col items-center gap-2 shrink-0">
                        <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mt-1">
                            <Bot className="w-4 h-4 text-primary" />
                        </div>
                        <div className="w-px bg-white/[0.06] flex-1 group-last:hidden"></div>
                    </div>

                    <div className="flex-1 min-w-0 space-y-3 pt-1">
                        <div className="flex items-center gap-2">
                            <span className="font-medium text-[13px] text-foreground">@{msg.clientId}</span>
                            <span className="text-[11px] text-muted-foreground/60">{new Date(msg.timestamp).toLocaleTimeString()}</span>
                        </div>

                        {msg.reasoningChunks.length > 0 && (
                            <details className="group/reasoning open:bg-white/[0.02] rounded-lg border border-transparent open:border-white/[0.05] transition-colors">
                                <summary className="flex items-center gap-2 text-[12px] font-medium text-muted-foreground cursor-pointer select-none py-1.5 px-2 hover:text-foreground transition-colors list-none">
                                    <Brain className="w-3.5 h-3.5" />
                                    Thought Process ({msg.reasoningChunks.length})
                                    <ChevronRight className="w-3.5 h-3.5 ml-auto group-open/reasoning:rotate-90 transition-transform" />
                                </summary>
                                <div className="p-3 pt-1 space-y-2 font-mono text-[12px] text-muted-foreground/80 italic border-t border-white/[0.04]">
                                    {msg.reasoningChunks.map((r: any, i: number) => (
                                        <div key={i} className="flex gap-3">
                                            <span className="shrink-0 opacity-40">{new Date(r.time).toLocaleTimeString()}</span>
                                            <span className="text-blue-200/60 leading-relaxed">{r.text}</span>
                                        </div>
                                    ))}
                                </div>
                            </details>
                        )}

                        {msg.toolCalls.length > 0 && (
                            <details className="group/tools open:bg-white/[0.02] rounded-lg border border-transparent open:border-white/[0.05] transition-colors">
                                <summary className="flex items-center gap-2 text-[12px] font-medium text-muted-foreground cursor-pointer select-none py-1.5 px-2 hover:text-foreground transition-colors list-none">
                                    <Wrench className="w-3.5 h-3.5" />
                                    Tools Used ({msg.toolCalls.length})
                                    <ChevronRight className="w-3.5 h-3.5 ml-auto group-open/tools:rotate-90 transition-transform" />
                                </summary>
                                <div className="p-3 pt-1 space-y-3 font-mono text-[12px] text-muted-foreground/80 border-t border-white/[0.04]">
                                    {msg.toolCalls.map((t: any, i: number) => (
                                        <div key={i} className="space-y-1.5">
                                            <div className="flex items-center gap-2 text-gray-300">
                                                {t.status === 'completed' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> :
                                                    t.status === 'error' ? <X className="w-3.5 h-3.5 text-red-400" /> :
                                                        <CircleDashed className="w-3.5 h-3.5 text-amber-400 animate-spin" />}
                                                <span className="font-semibold text-primary/80">{t.name}</span>
                                            </div>
                                            <div className="pl-5 overflow-x-auto text-[11px] opacity-70">
                                                <span className="text-white/40">Input:</span> {JSON.stringify(t.input)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </details>
                        )}

                        {msg.text && (
                            <div
                                className="prose prose-invert prose-sm max-w-none text-gray-200 leading-relaxed pt-1"
                                dangerouslySetInnerHTML={{ __html: marked.parse(msg.text) as string }}
                            />
                        )}
                    </div>
                </div>
            ))}
            <div ref={terminalRef} className="h-4"></div>
        </div>
    );
}
