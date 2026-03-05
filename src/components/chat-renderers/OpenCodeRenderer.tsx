"use client";

import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { Check, X, Loader2, ChevronRight, Sparkles, Clock3 } from "lucide-react";

import { Streamdown } from "streamdown";
import { cjk } from "@streamdown/cjk";
import { code } from "@streamdown/code";
import { math } from "@streamdown/math";
import { mermaid } from "@streamdown/mermaid";

const streamdownPlugins = { cjk, code, math, mermaid };

function getWarpToolTitle(toolName: string, inputData: any) {
    if (!inputData) return toolName;
    if (toolName === "bash" || toolName === "run_command" || toolName === "execute") {
        return inputData.command || inputData.CommandLine || inputData.cmd || toolName;
    }
    if (toolName === "read" || toolName === "view_file" || toolName === "edit" || toolName === "replace_file_content" || toolName === "multi_replace_file_content") {
        return inputData.path || inputData.TargetFile || inputData.file || inputData.AbsolutePath || toolName;
    }
    if (toolName === "grep_search" || toolName === "codesearch" || toolName === "search") {
        const query = inputData.Query || inputData.query;
        if (query) {
            return `Searched for "${query}" in ${inputData.SearchPath || inputData.path || inputData.dir || 'files'}`;
        }
    }
    if (toolName === "list_dir") {
        return `ls ${inputData.DirectoryPath || inputData.dir || ""}`;
    }
    return toolName;
}

export function OpenCodeRenderer({ parts }: { parts: any[] }) {
    const formatTs = (value: unknown) => {
        const text = typeof value === "string" ? value : "";
        const d = new Date(text);
        if (Number.isNaN(d.getTime())) return "";
        return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    };

    return (
        <div className="flex flex-col w-full text-[#F2F2F2] font-sans">
            {parts.map((p, i) => {
                switch (p.type) {
                    case "chat":
                        const isUser = p.role === "user";
                        const timeLabel = formatTs(p.timestamp);
                        return (
                            <div key={i} className={cn("my-2 flex", isUser ? "justify-end" : "justify-start")}>
                                <div className={cn(
                                    "max-w-[82%] rounded-[12px] px-4 py-3 text-[14px] leading-relaxed whitespace-pre-wrap border shadow-sm",
                                    isUser
                                        ? "bg-[#1E2530] border-[#2A3442] text-[#E7ECF6]"
                                        : "bg-[#16181A] border-[#232529] text-[#D1D3D8]",
                                )}>
                                    <div className="text-[10px] uppercase tracking-wide mb-1 opacity-70 flex items-center gap-1.5">
                                        <span>{isUser ? "You" : "Agent"}</span>
                                        {timeLabel && (
                                            <>
                                                <span>·</span>
                                                <Clock3 className="w-3 h-3" />
                                                <span>{timeLabel}</span>
                                            </>
                                        )}
                                    </div>
                                    <Streamdown plugins={streamdownPlugins}>
                                        {String(p.text || "")}
                                    </Streamdown>
                                </div>
                            </div>
                        );

                    case "session":
                        return (
                            <div key={i} className="my-4 flex justify-center">
                                <div className="px-3 py-1.5 text-[11px] rounded-full border border-[#2A2D32] bg-[#16181A] text-[#8A8F98] tracking-wide uppercase">
                                    {String(p.eventType || "session event").replace(/^session\./, "Session: ")}
                                </div>
                            </div>
                        );

                    case "meta":
                        return (
                            <div key={i} className="my-3 rounded-[8px] border border-[#232529] bg-[#111214] px-3 py-2 text-[12px] text-[#A1A6B4]">
                                {p.text}
                            </div>
                        );

                    case "step-start":
                    case "step-finish":
                    case "dashboard_prompt_dispatched":
                        // Warp doesn't typically show these underlying loop boundaries prominently
                        return null;

                    case "reasoning":
                        const reasoningText = p.text || p.content || (typeof p.payload === 'string' ? p.payload : p.payload?.text) || "";
                        if (!reasoningText) return null;
                        const durationSeconds = p.time ? Math.floor((p.time.end - p.time.start) / 1000) : null;
                        const durationText = durationSeconds ? `${durationSeconds} seconds` : "a few seconds";

                        return (
                            <Collapsible key={i} className="my-1.5 relative z-10">
                                <CollapsibleTrigger className="group flex items-center gap-2 text-[#5E626B] hover:text-[#8A8F98] transition-colors text-[13px] font-sans select-none">
                                    <Sparkles className="w-3.5 h-3.5 text-[#5E6AD2]" />
                                    <span>Thought for {durationText}</span>
                                    <ChevronRight className="w-3.5 h-3.5 group-data-[state=open]:rotate-90 transition-transform ml-1" />
                                </CollapsibleTrigger>
                                <CollapsibleContent className="mt-3 mb-6 text-[14px] text-[#A1A6B4] border-l-2 border-[#232529] pl-5 ml-[7px] overflow-x-auto whitespace-pre-wrap leading-relaxed outline-none data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2">
                                    <Streamdown plugins={streamdownPlugins}>
                                        {reasoningText}
                                    </Streamdown>
                                </CollapsibleContent>
                            </Collapsible>
                        );

                    case "tool":
                    case "message_part":
                        const toolName = p.tool || p.name || p.toolName || "Unknown Tool";
                        const state = p.state || {};

                        let inputData = state.input;
                        let outputData = state.output;
                        let status = state.status;

                        // Check alternative payload fields if 'state' object is empty
                        if (!inputData && p.input) inputData = p.input;
                        if (!inputData && p.payload?.input) inputData = p.payload.input;
                        if (!inputData && p.args) inputData = p.args;

                        if (!outputData && p.output) outputData = p.output;
                        if (!outputData && p.payload?.output) outputData = p.payload.output;
                        if (!outputData && p.result) outputData = p.result;

                        // Skip display if input is an empty object
                        if (inputData && typeof inputData === "object" && Object.keys(inputData).length === 0) {
                            inputData = undefined;
                        }

                        if (!status) {
                            if (outputData || p.status === "completed") status = "completed";
                            else status = "approval-requested";
                        }

                        if (toolName === "Unknown Tool" && !inputData) return null;

                        const isError = status === "output-error" || p.status === "error";
                        const isCompleted = status === "completed" || status === "output-available" || !!outputData;

                        const Icon = isError ? X : isCompleted ? Check : Loader2;
                        const iconColor = isError ? "text-[#E5534B]" : isCompleted ? "text-[#3FB950]" : "text-[#5E6AD2] animate-spin";

                        const title = getWarpToolTitle(toolName, inputData);

                        return (
                            <Collapsible key={i} className="my-1.5 w-full relative z-10">
                                <CollapsibleTrigger className="group flex w-full items-center justify-between gap-3 bg-[#1A1C20] hover:bg-[#232529] border border-[#232529] hover:border-[#2A2D32] transition-colors rounded-[8px] px-3.5 py-3 text-[13px] font-mono text-[#D1D3D8] shadow-sm">
                                    <div className="flex items-center gap-3 overflow-hidden min-w-0">
                                        <Icon className={cn("w-4 h-4 shrink-0 transition-colors", iconColor)} />
                                        <span className="truncate text-left select-text">{title}</span>
                                    </div>
                                    <ChevronRight className="w-4 h-4 shrink-0 text-[#5E626B] group-data-[state=open]:rotate-90 transition-transform" />
                                </CollapsibleTrigger>
                                <CollapsibleContent className="mt-2 text-popover-foreground outline-none data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2">
                                    <div className="bg-[#111214] border border-[#232529] shadow-inner rounded-[8px] p-4 overflow-x-auto">
                                        {inputData && (
                                            <div className="mb-4">
                                                <div className="text-[11px] uppercase tracking-wider text-[#5E626B] mb-2 font-sans font-medium">Input</div>
                                                <pre className="text-[12px] font-mono text-[#8A8F98] whitespace-pre-wrap select-text">
                                                    {typeof inputData === 'string' ? inputData : JSON.stringify(inputData, null, 2)}
                                                </pre>
                                            </div>
                                        )}
                                        {outputData && (
                                            <div>
                                                <div className="text-[11px] uppercase tracking-wider text-[#5E626B] mb-2 font-sans font-medium">
                                                    {isError ? "Error" : "Output"}
                                                </div>
                                                <div className={cn(
                                                    "text-[12px] font-mono whitespace-pre-wrap select-text",
                                                    isError ? "text-[#E5534B]" : "text-[#A1A6B4]"
                                                )}>
                                                    {typeof outputData === 'string' ? outputData : JSON.stringify(outputData, null, 2)}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </CollapsibleContent>
                            </Collapsible>
                        );

                    case "text":
                        const messageText = p.text || (typeof p.payload === 'string' ? p.payload : p.payload?.text) || p.content || "";
                        if (!messageText) return null;
                        return (
                            <div key={i} className="my-6 text-[14px] leading-relaxed text-[#D1D3D8] break-words">
                                <Streamdown plugins={streamdownPlugins}>
                                    {messageText}
                                </Streamdown>
                            </div>
                        );

                    case "file_edit_observed":
                    case "commit_observed":
                    case "conflict_alert":
                        return (
                            <div key={i} className="my-3 rounded-[8px] border border-[#232529] bg-[#111214] px-3 py-2 text-[12px] text-[#A1A6B4]">
                                <div className="text-[#D1D3D8] font-medium mb-1">{p.type}</div>
                                <pre className="whitespace-pre-wrap">
                                    {JSON.stringify(p.payload || p, null, 2)}
                                </pre>
                            </div>
                        );

                    default:
                        return null;
                }
            })}
        </div>
    );
}
