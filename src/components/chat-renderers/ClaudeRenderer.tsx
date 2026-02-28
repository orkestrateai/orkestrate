"use client";

import {
    Message,
    MessageContent,
    MessageResponse
} from "@/components/ai-elements/message";
import { Reasoning, ReasoningTrigger, ReasoningContent } from "@/components/ai-elements/reasoning";
import { Tool, ToolHeader, ToolContent, ToolInput, ToolOutput } from "@/components/ai-elements/tool";

export function ClaudeRenderer({ items }: { items: any[] }) {
    // Note: this assumes a simple flattened array for the mock.
    // Real claude trace might need linked list resolution (parentUuid).

    return (
        <div className="flex flex-col gap-6 mt-4">
            {items.map((item, i) => {
                if (item.type === "user") {
                    return (
                        <Message key={i} from="user">
                            <MessageContent>
                                <MessageResponse>{item.message.content?.[0]?.text}</MessageResponse>
                            </MessageContent>
                        </Message>
                    );
                }

                if (item.type === "assistant") {
                    return (
                        <Message key={i} from="assistant">
                            <MessageContent>
                                {item.message.content.map((c: any, j: number) => {
                                    if (c.type === "text") {
                                        return <MessageResponse key={j}>{c.text}</MessageResponse>;
                                    }
                                    if (c.type === "thinking") {
                                        return (
                                            <Reasoning key={j} defaultOpen={true}>
                                                <ReasoningTrigger />
                                                <ReasoningContent>{c.text}</ReasoningContent>
                                            </Reasoning>
                                        );
                                    }
                                    if (c.type === "tool_use") {
                                        // Find output in subsequent user item
                                        const resultEvent = items.find(
                                            nextItem => nextItem.type === "user" && nextItem.message.content.some((nc: any) => nc.type === "tool_result" && nc.tool_use_id === c.id)
                                        );
                                        const resultObj = resultEvent?.message.content.find((nc: any) => nc.type === "tool_result" && nc.tool_use_id === c.id);

                                        return (
                                            <Tool key={j}>
                                                <ToolHeader title={c.name} type="tool-call" state={resultObj ? "output-available" : "approval-requested"} />
                                                <ToolContent>
                                                    <ToolInput input={c.input} />
                                                    {resultObj && <ToolOutput output={resultObj.content} errorText="" />}
                                                </ToolContent>
                                            </Tool>
                                        );
                                    }
                                    return null;
                                })}
                            </MessageContent>
                        </Message>
                    );
                }

                return null;
            })}
        </div>
    );
}
