'use client';
import React, { useState, useMemo } from 'react';
import {
    ChevronRight,
    Terminal,
    Brain,
    MessageSquare,
    User,
    Wrench,
    CheckCircle2,
    AlertCircle,
    Play,
    Sparkles,
    Clock
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────
type TelemetryLog = {
    timestamp: string;
    clientId: string;
    agent: string;
    message: string;
    event: string;
};

type ParsedEvent =
    | { kind: 'user_prompt'; text: string; ts: string }
    | { kind: 'reasoning'; text: string; ts: string }
    | { kind: 'commentary'; text: string; ts: string }
    | { kind: 'final_answer'; text: string; ts: string }
    | { kind: 'tool_call'; name: string; args: string; callId: string; ts: string }
    | { kind: 'tool_output'; callId: string; output: string; exitCode: string | null; ts: string }
    | { kind: 'session_meta'; model: string; cwd: string; version: string; ts: string }
    | { kind: 'task_started'; turnId: string; ts: string }
    | { kind: 'task_complete'; turnId: string; lastMessage: string; ts: string }
    | { kind: 'system'; text: string; ts: string };

// ─── Parser ───────────────────────────────────────────────────────
function parseEvents(logs: TelemetryLog[]): ParsedEvent[] {
    const events: ParsedEvent[] = [];

    for (const log of logs) {
        try {
            const raw = JSON.parse(log.message);
            const ts = raw.timestamp || log.timestamp;

            // Session metadata
            if (raw.type === 'session_meta') {
                events.push({
                    kind: 'session_meta',
                    model: raw.payload?.model_provider || raw.payload?.model || 'unknown',
                    cwd: raw.payload?.cwd || '',
                    version: raw.payload?.cli_version || '',
                    ts
                });
                continue;
            }

            // Task lifecycle
            if (raw.type === 'event_msg') {
                const pt = raw.payload?.type;
                if (pt === 'task_started') {
                    events.push({ kind: 'task_started', turnId: raw.payload.turn_id || '', ts });
                    continue;
                }
                if (pt === 'task_complete') {
                    events.push({
                        kind: 'task_complete',
                        turnId: raw.payload.turn_id || '',
                        lastMessage: raw.payload.last_agent_message || '',
                        ts
                    });
                    continue;
                }
                if (pt === 'agent_reasoning') {
                    events.push({ kind: 'reasoning', text: raw.payload.text || '', ts });
                    continue;
                }
                // Skip noise
                continue;
            }

            // Response items
            if (raw.type === 'response_item') {
                const p = raw.payload;

                // User message
                if (p?.type === 'message' && p?.role === 'user') {
                    const text = p.content?.map((c: any) => c.text || '').join('\n').trim();
                    if (text) events.push({ kind: 'user_prompt', text, ts });
                    continue;
                }

                // Assistant message
                if (p?.type === 'message' && p?.role === 'assistant') {
                    const text = p.content?.map((c: any) => c.text || '').join('\n').trim();
                    if (text) {
                        const kind = p.phase === 'final_answer' ? 'final_answer' : 'commentary';
                        events.push({ kind, text, ts });
                    }
                    continue;
                }

                // Developer message (skip — internal prompts)
                if (p?.type === 'message' && p?.role === 'developer') continue;

                // Reasoning
                if (p?.type === 'reasoning') {
                    const text = p.summary?.map((s: any) => s.text || '').join(' ').trim();
                    if (text) events.push({ kind: 'reasoning', text, ts });
                    continue;
                }

                // Tool call
                if (p?.type === 'function_call') {
                    events.push({
                        kind: 'tool_call',
                        name: p.name || 'unknown',
                        args: p.arguments || '{}',
                        callId: p.call_id || '',
                        ts
                    });
                    continue;
                }

                // Tool output
                if (p?.type === 'function_call_output') {
                    let output = p.output || '';
                    let exitCode: string | null = null;
                    // Extract exit code if present
                    const exitMatch = output.match(/Exit code: (\d+)/);
                    if (exitMatch) exitCode = exitMatch[1];
                    events.push({
                        kind: 'tool_output',
                        callId: p.call_id || '',
                        output,
                        exitCode,
                        ts
                    });
                    continue;
                }
            }
        } catch (e) {
            // Non-JSON log lines
            if (log.message?.trim()) {
                events.push({ kind: 'system', text: log.message, ts: log.timestamp });
            }
        }
    }

    return events;
}

// ─── Merge tool calls with their outputs ──────────────────────────
type MergedToolCall = {
    name: string;
    args: string;
    callId: string;
    output: string | null;
    exitCode: string | null;
    ts: string;
};

type DisplayItem =
    | { type: 'user_prompt'; text: string; ts: string }
    | { type: 'reasoning'; text: string; ts: string }
    | { type: 'commentary'; text: string; ts: string }
    | { type: 'final_answer'; text: string; ts: string }
    | { type: 'tool'; tool: MergedToolCall }
    | { type: 'session_meta'; model: string; cwd: string; version: string; ts: string }
    | { type: 'turn_boundary'; turnId: string; kind: 'start' | 'complete'; lastMessage?: string; ts: string }
    | { type: 'system'; text: string; ts: string };

function mergeEvents(events: ParsedEvent[]): DisplayItem[] {
    const items: DisplayItem[] = [];
    const pendingTools = new Map<string, MergedToolCall>();

    for (const evt of events) {
        switch (evt.kind) {
            case 'user_prompt':
                items.push({ type: 'user_prompt', text: evt.text, ts: evt.ts });
                break;
            case 'reasoning':
                items.push({ type: 'reasoning', text: evt.text, ts: evt.ts });
                break;
            case 'commentary':
                items.push({ type: 'commentary', text: evt.text, ts: evt.ts });
                break;
            case 'final_answer':
                items.push({ type: 'final_answer', text: evt.text, ts: evt.ts });
                break;
            case 'session_meta':
                items.push({ type: 'session_meta', model: evt.model, cwd: evt.cwd, version: evt.version, ts: evt.ts });
                break;
            case 'task_started':
                items.push({ type: 'turn_boundary', turnId: evt.turnId, kind: 'start', ts: evt.ts });
                break;
            case 'task_complete':
                items.push({ type: 'turn_boundary', turnId: evt.turnId, kind: 'complete', lastMessage: evt.lastMessage, ts: evt.ts });
                break;
            case 'tool_call': {
                const tool: MergedToolCall = {
                    name: evt.name,
                    args: evt.args,
                    callId: evt.callId,
                    output: null,
                    exitCode: null,
                    ts: evt.ts
                };
                pendingTools.set(evt.callId, tool);
                items.push({ type: 'tool', tool });
                break;
            }
            case 'tool_output': {
                const pending = pendingTools.get(evt.callId);
                if (pending) {
                    pending.output = evt.output;
                    pending.exitCode = evt.exitCode;
                } else {
                    // Orphan output — create standalone entry
                    items.push({
                        type: 'tool',
                        tool: {
                            name: 'unknown',
                            args: '',
                            callId: evt.callId,
                            output: evt.output,
                            exitCode: evt.exitCode,
                            ts: evt.ts
                        }
                    });
                }
                break;
            }
            case 'system':
                items.push({ type: 'system', text: evt.text, ts: evt.ts });
                break;
        }
    }

    return items;
}

// ─── Sub-Components ───────────────────────────────────────────────

function Timestamp({ ts }: { ts: string }) {
    return (
        <span className="text-[10px] font-mono text-white/20 tabular-nums shrink-0">
            {new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>
    );
}

function SessionMeta({ item }: { item: Extract<DisplayItem, { type: 'session_meta' }> }) {
    return (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-gradient-to-r from-indigo-500/5 to-purple-500/5 border border-indigo-500/10">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-mono">
                <span className="text-indigo-300">{item.model}</span>
                <span className="text-white/20">•</span>
                <span className="text-white/40">{item.version}</span>
                <span className="text-white/20">•</span>
                <span className="text-white/30 truncate max-w-[300px]">{item.cwd}</span>
            </div>
            <Timestamp ts={item.ts} />
        </div>
    );
}

function UserPrompt({ item }: { item: Extract<DisplayItem, { type: 'user_prompt' }> }) {
    return (
        <div className="flex gap-3 items-start py-3">
            <div className="w-6 h-6 rounded-md bg-blue-500/15 border border-blue-500/20 flex items-center justify-center shrink-0 mt-0.5">
                <User className="w-3 h-3 text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
                <div className="text-[10px] font-mono text-blue-400/60 mb-1 flex items-center gap-2">
                    user <Timestamp ts={item.ts} />
                </div>
                <p className="text-sm text-white/90 leading-relaxed">{item.text}</p>
            </div>
        </div>
    );
}

function ReasoningBlock({ item }: { item: Extract<DisplayItem, { type: 'reasoning' }> }) {
    const [open, setOpen] = useState(false);
    return (
        <div
            className="flex gap-3 items-start py-1 cursor-pointer group/reason"
            onClick={() => setOpen(!open)}
        >
            <div className="w-6 h-6 rounded-md bg-violet-500/10 border border-violet-500/15 flex items-center justify-center shrink-0 mt-0.5">
                <Brain className="w-3 h-3 text-violet-400/60" />
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-[11px] text-violet-400/50 font-mono">
                    <ChevronRight className={`w-3 h-3 transition-transform ${open ? 'rotate-90' : ''}`} />
                    <span className="italic">Thinking...</span>
                    <Timestamp ts={item.ts} />
                </div>
                {open && (
                    <p className="text-[12px] text-violet-300/40 mt-1.5 leading-relaxed font-mono pl-5 border-l border-violet-500/10">
                        {item.text}
                    </p>
                )}
            </div>
        </div>
    );
}

function CommentaryBlock({ item }: { item: Extract<DisplayItem, { type: 'commentary' }> }) {
    return (
        <div className="flex gap-3 items-start py-2">
            <div className="w-6 h-6 rounded-md bg-white/[0.03] border border-white/[0.06] flex items-center justify-center shrink-0 mt-0.5">
                <MessageSquare className="w-3 h-3 text-white/30" />
            </div>
            <div className="flex-1 min-w-0">
                <div className="text-[10px] font-mono text-white/20 mb-1 flex items-center gap-2">
                    commentary <Timestamp ts={item.ts} />
                </div>
                <p className="text-[13px] text-white/50 leading-relaxed italic">{item.text}</p>
            </div>
        </div>
    );
}

function FinalAnswer({ item }: { item: Extract<DisplayItem, { type: 'final_answer' }> }) {
    return (
        <div className="flex gap-3 items-start py-3">
            <div className="w-6 h-6 rounded-md bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5">
                <Sparkles className="w-3 h-3 text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
                <div className="text-[10px] font-mono text-emerald-400/60 mb-1.5 flex items-center gap-2">
                    response <Timestamp ts={item.ts} />
                </div>
                <div className="text-sm text-white/85 leading-relaxed whitespace-pre-wrap">
                    {item.text}
                </div>
            </div>
        </div>
    );
}

function ToolCallBlock({ item }: { item: Extract<DisplayItem, { type: 'tool' }> }) {
    const [open, setOpen] = useState(false);
    const { tool } = item;

    // Determine display name and parse args for pretty printing
    const displayName = tool.name
        .replace(/^mcp__\w+__/, '')        // strip MCP prefix
        .replace(/^shell_command$/, 'shell')
        .replace(/_/g, ' ');

    let prettyArgs = '';
    try {
        const parsed = JSON.parse(tool.args);
        // For shell commands, show the command directly
        if (parsed.command) {
            prettyArgs = parsed.command;
        } else if (parsed.path) {
            prettyArgs = parsed.path;
        } else {
            prettyArgs = JSON.stringify(parsed, null, 2);
        }
    } catch (e) {
        prettyArgs = tool.args;
    }

    const isSuccess = tool.exitCode === '0' || tool.exitCode === null;
    const isPending = tool.output === null;

    // Truncate long output for display
    const maxOutputLen = 2000;
    const outputText = tool.output || '';
    const truncatedOutput = outputText.length > maxOutputLen
        ? outputText.substring(0, maxOutputLen) + `\n... (${outputText.length - maxOutputLen} chars truncated)`
        : outputText;

    return (
        <div className="my-1">
            <div
                className={`rounded-lg border transition-colors cursor-pointer ${isPending
                        ? 'border-amber-500/20 bg-amber-500/[0.03]'
                        : isSuccess
                            ? 'border-white/[0.06] bg-white/[0.015] hover:bg-white/[0.03]'
                            : 'border-red-500/15 bg-red-500/[0.02]'
                    }`}
                onClick={() => setOpen(!open)}
            >
                {/* Tool header */}
                <div className="flex items-center gap-2.5 px-3 py-2">
                    <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${isPending ? 'bg-amber-500/15' : isSuccess ? 'bg-emerald-500/10' : 'bg-red-500/10'
                        }`}>
                        {isPending ? (
                            <Clock className="w-3 h-3 text-amber-400 animate-pulse" />
                        ) : isSuccess ? (
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        ) : (
                            <AlertCircle className="w-3 h-3 text-red-400" />
                        )}
                    </div>

                    <Wrench className="w-3 h-3 text-white/25 shrink-0" />
                    <span className="text-[12px] font-semibold text-white/70 font-mono">{displayName}</span>

                    {tool.exitCode !== null && (
                        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${isSuccess ? 'text-emerald-400/70 bg-emerald-400/10' : 'text-red-400/70 bg-red-400/10'
                            }`}>
                            exit {tool.exitCode}
                        </span>
                    )}

                    <Timestamp ts={tool.ts} />

                    <ChevronRight className={`w-3 h-3 ml-auto text-white/20 transition-transform ${open ? 'rotate-90' : ''}`} />
                </div>

                {/* Expanded content */}
                {open && (
                    <div className="border-t border-white/[0.04] px-3 py-2 space-y-2">
                        {/* Arguments */}
                        {prettyArgs && (
                            <div>
                                <div className="text-[9px] font-mono text-white/25 uppercase tracking-widest mb-1">Input</div>
                                <pre className="text-[11px] font-mono text-cyan-300/60 bg-black/40 rounded px-3 py-2 overflow-x-auto max-h-[200px] overflow-y-auto whitespace-pre-wrap break-all leading-relaxed">
                                    {prettyArgs}
                                </pre>
                            </div>
                        )}
                        {/* Output */}
                        {tool.output !== null && (
                            <div>
                                <div className="text-[9px] font-mono text-white/25 uppercase tracking-widest mb-1">Output</div>
                                <pre className={`text-[11px] font-mono rounded px-3 py-2 overflow-x-auto max-h-[300px] overflow-y-auto whitespace-pre-wrap break-all leading-relaxed ${isSuccess ? 'text-white/50 bg-black/40' : 'text-red-300/60 bg-red-950/20'
                                    }`}>
                                    {truncatedOutput || '(empty)'}
                                </pre>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

function TurnBoundary({ item }: { item: Extract<DisplayItem, { type: 'turn_boundary' }> }) {
    if (item.kind === 'start') {
        return (
            <div className="flex items-center gap-3 py-3 mt-2">
                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
                <div className="flex items-center gap-1.5 text-[10px] font-mono text-white/15">
                    <Play className="w-2.5 h-2.5" />
                    turn started
                </div>
                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
            </div>
        );
    }
    return null; // task_complete is implicit via final_answer
}

function SystemEvent({ item }: { item: Extract<DisplayItem, { type: 'system' }> }) {
    return (
        <div className="flex items-center gap-2 py-1 text-[10px] font-mono text-white/15">
            <Terminal className="w-3 h-3 shrink-0" />
            <span className="truncate">{item.text}</span>
        </div>
    );
}

// ─── Main Renderer ────────────────────────────────────────────────

interface CodexRendererProps {
    logs: TelemetryLog[];
    terminalRef: React.RefObject<HTMLDivElement | null>;
}

export function CodexRenderer({ logs, terminalRef }: CodexRendererProps) {
    const items = useMemo(() => {
        const events = parseEvents(logs);
        return mergeEvents(events);
    }, [logs]);

    if (items.length === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-white/20 text-sm space-y-3">
                <Terminal className="w-8 h-8 opacity-30" />
                <p>Waiting for telemetry data...</p>
            </div>
        );
    }

    return (
        <div className="space-y-0.5 pb-12">
            {items.map((item, idx) => {
                switch (item.type) {
                    case 'session_meta':
                        return <SessionMeta key={idx} item={item} />;
                    case 'user_prompt':
                        return <UserPrompt key={idx} item={item} />;
                    case 'reasoning':
                        return <ReasoningBlock key={idx} item={item} />;
                    case 'commentary':
                        return <CommentaryBlock key={idx} item={item} />;
                    case 'final_answer':
                        return <FinalAnswer key={idx} item={item} />;
                    case 'tool':
                        return <ToolCallBlock key={idx} item={item} />;
                    case 'turn_boundary':
                        return <TurnBoundary key={idx} item={item} />;
                    case 'system':
                        return <SystemEvent key={idx} item={item} />;
                    default:
                        return null;
                }
            })}
            <div ref={terminalRef} className="h-4" />
        </div>
    );
}
