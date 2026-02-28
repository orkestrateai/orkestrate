"use client";

import {
    Message,
    MessageContent,
    MessageResponse
} from "@/components/ai-elements/message";
import { Reasoning, ReasoningTrigger, ReasoningContent } from "@/components/ai-elements/reasoning";
import { Tool, ToolHeader, ToolContent, ToolInput, ToolOutput } from "@/components/ai-elements/tool";

export function CodexRenderer({ events }: { events: any[] }) {
    return (
        <div className="flex flex-col gap-4 mt-4">
            {events.map((e, i) => {
                if (e.type === "session_meta") {
                    return (
                        <div key={i} className="text-xs text-zinc-500 bg-zinc-900 border border-zinc-800 p-2 rounded-md mb-2">
                            Session Started: {e.payload.cwd} ({e.payload.model_provider})
                        </div>
                    );
                }

                if (e.type === "event_msg" && e.payload.type === "task_complete") {
                    return (
                        <div key={i} className=" border-b border-zinc-800 my-2 w-full" />
                    );
                }

                if (e.type === "response_item") {
                    const p = e.payload;
                    if (p.type === "message" && p.role === "assistant") {
                        return (
                            <Message key={i} from="assistant">
                                <MessageContent>
                                    <MessageResponse>{p.content?.[0]?.text}</MessageResponse>
                                </MessageContent>
                            </Message>
                        );
                    }

                    if (p.type === "reasoning") {
                        return (
                            <Message key={i} from="assistant">
                                <MessageContent>
                                    <Reasoning defaultOpen={false}>
                                        <ReasoningTrigger title="Thinking..." />
                                        <ReasoningContent>{p.summary}</ReasoningContent>
                                    </Reasoning>
                                </MessageContent>
                            </Message>
                        );
                    }

                    if (p.type === "function_call") {
                        // Find matching output if it exists ahead
                        const nextEvt = events.slice(i + 1).find(
                            ev => ev.type === "response_item" && ev.payload.type === "function_call_output" && ev.payload.call_id === p.call_id
                        );

                        let parsedArgs = p.arguments;
                        try {
                            parsedArgs = typeof p.arguments === "string" ? JSON.parse(p.arguments) : p.arguments;
                        } catch { }

                        return (
                            <Message key={i} from="assistant">
                                <MessageContent>
                                    <Tool>
                                        <ToolHeader
                                            title={p.name}
                                            type="tool-call"
                                            state={nextEvt ? "output-available" : "approval-requested"}
                                        />
                                        <ToolContent>
                                            <ToolInput input={parsedArgs} />
                                            {nextEvt && <ToolOutput output={nextEvt.payload.output} errorText="" />}
                                        </ToolContent>
                                    </Tool>
                                </MessageContent>
                            </Message>
                        );
                    }

                    if (p.type === "function_call_output") {
                        // Rendered together with function_call, so we skip it here
                        return null;
                    }
                }

                return null;
            })}
        </div>
    );
}
