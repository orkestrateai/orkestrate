"use client";
import { useState, useEffect, useRef, useMemo } from "react";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";
import { Navbar } from "@/components/Navbar";
import { PlusCircle, FileText, Hash, Settings, ChevronRight, Trash2 } from "lucide-react";
import Link from "next/link";
import { AgentTelemetryPane } from "@/components/dashboard/AgentTelemetryPane";
import { WorkspaceContentPane } from "@/components/dashboard/WorkspaceContentPane";
import { useResizablePane } from "@/hooks/useResizablePane";

export default function Dashboard() {
    const [user, setUser] = useState<any>(null);
    const [session, setSession] = useState<any>(null);
    const [supabase] = useState(() => createSupabaseBrowserClient());

    const [rooms, setRooms] = useState<any[]>([]);
    const [activeRoom, setActiveRoom] = useState<any>(null);
    const [content, setContent] = useState<string>("");
    const [activeAgentCount, setActiveAgentCount] = useState<number>(0);
    const [dbActiveAgents, setDbActiveAgents] = useState<Array<{
        clientId: string;
        projectId: string;
        lastPingAt: string;
        stateHash: string;
        agentProfile: string;
        currentObjective: string;
    }>>([]);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [loading, setLoading] = useState(false);

    // Telemetry Terminal State
    const [telemetryLogs, setTelemetryLogs] = useState<{ timestamp: string; clientId: string; agent: string; message: string; event: string }[]>([]);
    const terminalRef = useRef<HTMLDivElement>(null);
    const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
    const { splitPercent, containerRef, gutterProps, leftStyle, rightStyle } = useResizablePane({
        defaultPercent: 50,
        minPercent: 25,
        maxPercent: 80
    });

    // Helper to extract text from potentially stringified JSON blocks
    function extractText(val: any): string {
        if (!val) return '';
        if (typeof val !== 'string') return JSON.stringify(val);
        try {
            const parsedVal = JSON.parse(val);
            if (Array.isArray(parsedVal)) {
                return parsedVal.map((block: any) => block.text || '').join('\n');
            }
        } catch (e) { /* Not JSON */ }
        return val;
    }

    // Derived State: Group raw streaming JSON logs into conversational turns
    type ChatMessage = {
        id: string;
        clientId: string;
        agent: string;
        timestamp: string;
        text?: string;
        reasoningChunks: { time: string, text: string }[];
        toolCalls: { id: string, name: string, input: any, output?: any, status: 'running' | 'completed' | 'error' }[];
    }

    const chatFeed = useMemo(() => {
        const messages: ChatMessage[] = [];
        // Track the current active message per agent for O(1) lookups
        const activeMessages = new Map<string, ChatMessage>();

        telemetryLogs.forEach((log) => {
            if (log.event === 'system') return;

            try {
                const parsed = JSON.parse(log.message);
                if (!parsed.type) return;

                const agentKey = `${log.clientId}-${log.agent}`;
                let activeMsg = activeMessages.get(agentKey);

                if (parsed.type === 'step-start' || !activeMsg) {
                    activeMsg = {
                        id: log.timestamp + log.clientId,
                        clientId: log.clientId,
                        agent: log.agent,
                        timestamp: log.timestamp,
                        reasoningChunks: [],
                        toolCalls: []
                    };
                    messages.push(activeMsg);
                    activeMessages.set(agentKey, activeMsg);
                }

                const payload = parsed.payload;

                switch (parsed.type) {
                    case 'reasoning':
                        if (payload.text) {
                            activeMsg.reasoningChunks.push({ time: log.timestamp, text: payload.text });
                        }
                        break;
                    case 'tool':
                        if (payload.callID) {
                            const existing = activeMsg.toolCalls.find((t: any) => t.id === payload.callID);
                            if (existing) {
                                existing.status = payload.state?.status || 'running';
                                if (payload.state?.output) existing.output = payload.state.output;
                            } else {
                                activeMsg.toolCalls.push({
                                    id: payload.callID,
                                    name: payload.tool,
                                    input: payload.state?.input,
                                    status: payload.state?.status || 'running'
                                });
                            }
                        }
                        break;
                    case 'text':
                        if (payload.text) {
                            activeMsg.text = extractText(payload.text);
                        }
                        break;
                    case 'response_item':
                        if (payload.output) {
                            const extracted = extractText(payload.output);
                            if (extracted.includes("Exit code: ") && extracted.includes("Wall time: ")) {
                                if (activeMsg.toolCalls.length > 0) {
                                    activeMsg.toolCalls[activeMsg.toolCalls.length - 1].output = extracted;
                                }
                            } else if (!activeMsg.text || activeMsg.text.length < extracted.length) {
                                activeMsg.text = extracted;
                            }
                        }
                        break;
                    case 'step-finish':
                        if (!activeMsg.text) activeMsg.text = "*(Execution Complete)*";
                        // Clear from active map so next event starts a new message
                        activeMessages.delete(agentKey);
                        break;
                }

            } catch (e) {
                // Not JSON — raw string message
            }
        });

        return messages;
    }, [telemetryLogs]);

    // Track agent liveness: last-seen timestamps from any event (log, heartbeat, etc.)
    const [agentLastSeen, setAgentLastSeen] = useState<Map<string, number>>(new Map());
    const [disconnectedAgents, setDisconnectedAgents] = useState<Set<string>>(new Set());

    const activeAgentsList = useMemo(() => {
        const agents = new Map<string, {
            id: string,
            clientId: string,
            agent: string,
            name: string,
            lastMessage: string,
            lastUpdate: string,
            status: 'online' | 'offline' | 'disconnected'
        }>();
        const now = Date.now();
        const STALE_THRESHOLD = 30000; // 30 seconds without heartbeat = offline

        // Derive agents from ALL telemetry logs — this persists after disconnect
        telemetryLogs.forEach(log => {
            const agentKey = `${log.clientId}-${log.agent}`;
            if (!agentKey || agentKey === 'undefined-undefined') return;

            // Try to extract a meaningful last-action from the log
            let lastAction = '';
            try {
                const parsed = JSON.parse(log.message);
                if (parsed.type === 'response_item' && parsed.payload?.type === 'message' && parsed.payload?.role === 'assistant') {
                    const txt = parsed.payload.content?.[0]?.text;
                    if (txt) lastAction = txt;
                } else if (parsed.type === 'response_item' && parsed.payload?.type === 'function_call') {
                    lastAction = `Running: ${parsed.payload.name}()`;
                } else if (parsed.type === 'event_msg' && parsed.payload?.type === 'agent_reasoning') {
                    lastAction = `Thinking: ${parsed.payload.text}`;
                }
            } catch (e) {
                lastAction = log.message?.substring(0, 80) || '';
            }

            // Determine agent connectivity status
            let status: 'online' | 'offline' | 'disconnected' = 'online';
            if (disconnectedAgents.has(agentKey)) {
                status = 'disconnected';
            } else {
                const lastSeenTime = agentLastSeen.get(agentKey);
                if (lastSeenTime && (now - lastSeenTime > STALE_THRESHOLD)) {
                    status = 'offline';
                }
            }

            const existing = agents.get(agentKey);
            // Only update if this log is newer or has a meaningful action
            if (!existing || new Date(log.timestamp).getTime() > new Date(existing.lastUpdate).getTime()) {
                agents.set(agentKey, {
                    id: agentKey,
                    clientId: log.clientId,
                    agent: log.agent,
                    name: `@${log.clientId} (${log.agent})`,
                    lastMessage: lastAction || existing?.lastMessage || '',
                    lastUpdate: log.timestamp,
                    status
                });
            } else if (lastAction && !existing.lastMessage) {
                existing.lastMessage = lastAction;
            }
        });

        // Merge active agents from DB heartbeats so "Agents" list doesn't disappear
        // when telemetry stream is sparse or filtered.
        dbActiveAgents.forEach((dbAgent) => {
            const telemetryMatch = Array.from(agents.values()).find((a) => a.clientId === dbAgent.clientId);
            if (telemetryMatch) return;
            const fallbackId = `${dbAgent.clientId}::__state`;
            agents.set(fallbackId, {
                id: fallbackId,
                clientId: dbAgent.clientId,
                agent: 'unknown',
                name: `@${dbAgent.clientId} (${dbAgent.agentProfile || 'agent'})`,
                lastMessage: dbAgent.currentObjective || 'Connected via state heartbeat',
                lastUpdate: dbAgent.lastPingAt,
                status: 'online'
            });
        });

        // Sort by most recent
        return Array.from(agents.values()).sort((a, b) => new Date(b.lastUpdate).getTime() - new Date(a.lastUpdate).getTime());
    }, [telemetryLogs, agentLastSeen, disconnectedAgents, dbActiveAgents]);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
            setSession(session);
        });
    }, [supabase.auth]);

    // Setup Telemetry Subscription
    useEffect(() => {
        const channel = supabase.channel('telemetry:live', {
            config: {
                broadcast: { ack: false }
            }
        });

        channel.on('broadcast', { event: 'log' }, (rawPayload) => {
            const p = rawPayload.payload;
            const targetRoomId = activeRoom?.id || 'default';
            let payloadRoomId: string | null = p?.roomId || null;
            if (!payloadRoomId && typeof p?.message === 'string') {
                try {
                    const parsed = JSON.parse(p.message);
                    payloadRoomId = parsed?.payload?.roomId || parsed?.roomId || null;
                } catch {
                    payloadRoomId = null;
                }
            }
            if (payloadRoomId && payloadRoomId !== targetRoomId) return;
            if (!payloadRoomId && targetRoomId !== 'default') return;
            const agentKey = `${p.clientId}-${p.agent}`;

            // Update last-seen timestamp for this agent on every event
            setAgentLastSeen(prev => {
                const next = new Map(prev);
                next.set(agentKey, Date.now());
                return next;
            });

            // Handle lifecycle system events
            try {
                const parsed = JSON.parse(p.message);
                if (parsed.type === 'disconnect') {
                    setDisconnectedAgents(prev => {
                        const next = new Set(prev);
                        next.add(agentKey);
                        return next;
                    });
                    // Don't add disconnect events to normal chat feed
                    return;
                }
                if (parsed.type === 'connect') {
                    // Agent reconnected — remove from disconnected set
                    setDisconnectedAgents(prev => {
                        const next = new Set(prev);
                        next.delete(agentKey);
                        return next;
                    });
                }
                if (parsed.type === 'heartbeat') {
                    // Heartbeat already handled above via agentLastSeen update
                    return;
                }
            } catch (e) {
                // Not JSON — that's fine, it's a raw log line
            }

            setTelemetryLogs(prev => [...prev.slice(-499), p]); // Keep last 500 logs
        }).subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                console.log("[Dashboard] Subscribed to telemetry:live stream");
            }
        });

        // Periodic sweep to trigger stale agent detection (forces useMemo re-eval)
        const sweepInterval = setInterval(() => {
            setAgentLastSeen(prev => new Map(prev)); // Shallow clone triggers re-render
        }, 10000);

        return () => {
            supabase.removeChannel(channel);
            clearInterval(sweepInterval);
        };
    }, [supabase, activeRoom?.id]);

    // Auto-scroll terminal
    useEffect(() => {
        if (terminalRef.current) {
            terminalRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [chatFeed, selectedAgentId]);

    useEffect(() => {
        if (session?.access_token) {
            fetchRooms();
        }
    }, [session]);

    const fetchTelemetryHistory = async (roomId?: string) => {
        if (!session?.access_token) return;
        try {
            const targetRoomId = roomId || activeRoom?.id;
            if (!targetRoomId) return;
            const res = await fetch(`/api/telemetry-history?sinceHours=24&roomId=${encodeURIComponent(targetRoomId)}`, {
                headers: { Authorization: `Bearer ${session.access_token}` },
            });
            if (!res.ok) return;
            const data = await res.json();
            if (Array.isArray(data.logs)) {
                setTelemetryLogs(data.logs.slice(-500));
            }
        } catch (e) {
            console.error("Failed to fetch telemetry history:", e);
        }
    };

    useEffect(() => {
        let interval: any;
        if (session?.access_token && activeRoom) {
            fetchContent();
            fetchTelemetryHistory(activeRoom.id);
            // Poll every 2s
            interval = setInterval(fetchContent, 2000);
        }
        return () => clearInterval(interval);
    }, [activeRoom, session]);

    const fetchRooms = async () => {
        if (!session?.access_token) return;
        const res = await fetch("/api/rooms", {
            headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const data = await res.json();
        if (data.rooms) {
            setRooms(data.rooms);
            const active = data.rooms.find((r: any) => r.isActive) || data.rooms[0] || null;
            setActiveRoom(active);
        }
    };

    const fetchContent = async () => {
        if (!activeRoom) return;
        const res = await fetch(`/api/room-content?roomId=${encodeURIComponent(activeRoom.id)}`, {
            headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const data = await res.json();
        if (data.content !== undefined) {
            setContent(data.content);
            setActiveAgentCount(data.activeAgentCount || 0);
            setDbActiveAgents(Array.isArray(data.activeAgents) ? data.activeAgents : []);
            setLastUpdated(new Date());
        }
    };

    const handleSwitchRoom = async (roomId: string) => {
        if (!session?.access_token || roomId === activeRoom?.id) return;

        // 1. Optimistic UI update for instant feedback
        const nextRoom = rooms.find(r => r.id === roomId);
        if (nextRoom) {
            setActiveRoom(nextRoom);
            setRooms(rooms.map(r => ({ ...r, isActive: r.id === roomId })));
            setContent(""); // Instantly clear the canvas
        }

        // 2. Background sync
        fetch("/api/rooms", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${session.access_token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ action: "switch", roomId }),
        }).catch(console.error);
    };

    const handleDeleteRoom = async (roomId: string) => {
        if (!session?.access_token) return;

        // Optimistic delete
        setRooms(rooms.filter(r => r.id !== roomId));
        if (activeRoom?.id === roomId) {
            setActiveRoom(null);
            setContent("");
        }

        fetch("/api/rooms", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${session.access_token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ action: "delete", roomId }),
        }).catch(console.error);
    };

    const handleCreateRoom = async () => {
        if (!session?.access_token) return;
        const providedName = window.prompt("Room name (optional):", "");
        if (providedName === null) return;

        setLoading(true);
        try {
            const res = await fetch("/api/rooms", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    action: "create",
                    name: providedName.trim() || undefined,
                }),
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err?.error || "Failed to create room");
            }

            const data = await res.json();
            const createdRoomId = data?.room?.id;
            await fetchRooms();
            if (createdRoomId) {
                await handleSwitchRoom(createdRoomId);
            }
        } catch (error) {
            console.error(error);
            window.alert("Could not create room. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    if (!user) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white px-4">
                <p className="text-muted-foreground mb-4">You must be signed in to view workspaces.</p>
                <Link href="/" className="text-sm font-medium hover:underline text-foreground">
                    Return Home
                </Link>
            </div>
        );
    }

    return (
        <div className="min-h-[100dvh] h-[100dvh] flex flex-col bg-black text-foreground overflow-hidden">
            <Navbar user={user} handleLogin={() => { }} handleLogout={() => supabase.auth.signOut()} />

            {/* Subtract navbar height */}
            <div className="flex flex-1 pt-[72px] h-full overflow-hidden relative">

                {/* SIDEBAR */}
                <aside className="w-64 border-r border-white/[0.06] bg-black/40 flex flex-col flex-shrink-0 relative z-10 hidden md:flex backdrop-blur-sm">
                    <div className="p-5 border-b border-white/[0.06] flex items-center justify-between">
                        <h2 className="text-[11px] font-semibold tracking-widest uppercase text-muted-foreground">Workspaces</h2>
                        <button
                            onClick={handleCreateRoom}
                            disabled={loading}
                            className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <PlusCircle className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-3 space-y-1 mt-2">
                        {rooms.length === 0 ? (
                            <p className="text-xs text-muted-foreground text-center py-6">No workspaces found.</p>
                        ) : (
                            rooms.map((room) => (
                                <button
                                    key={room.id}
                                    onClick={() => handleSwitchRoom(room.id)}
                                    className={`w-full group flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all ${room.isActive
                                        ? "bg-white/[0.06] text-foreground font-medium border border-white/[0.08]"
                                        : "text-muted-foreground hover:bg-white/[0.02] hover:text-foreground border border-transparent"
                                        }`}
                                >
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <Hash className="w-3.5 h-3.5 shrink-0 opacity-60" />
                                        <span className="truncate">{room.name || room.id}</span>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        {room.isActive && <div className="w-1.5 h-1.5 rounded-full bg-primary/80"></div>}
                                        <div
                                            role="button"
                                            tabIndex={0}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteRoom(room.id);
                                            }}
                                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/[0.05] rounded text-muted-foreground hover:text-red-400 transition-all cursor-pointer"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </div>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>

                    <div className="p-5 border-t border-white/[0.06]">
                        <div className="bg-black/30 border border-white/[0.05] rounded-lg p-4 text-xs text-muted-foreground">
                            <p className="mb-3 leading-relaxed">Agents evaluate the active workspace to coordinate tasks and prevent context shifts.</p>
                            <div className="flex items-center gap-2 text-muted-foreground/80">
                                <Settings className="w-3.5 h-3.5" />
                                <span>Auto-sync enabled</span>
                            </div>
                        </div>
                    </div>
                </aside>

                {/* RESIZABLE DUAL-PANE SPLIT */}
                <main ref={containerRef} className="flex-1 flex min-w-0 bg-black/20 relative z-0">

                    {/* LEFT PANE: AGENT TELEMETRY */}
                    <div style={leftStyle} className="flex flex-col border-r border-white/[0.06] bg-black/40 relative z-10 overflow-hidden">
                        <AgentTelemetryPane
                            chatFeed={chatFeed}
                            telemetryLogs={telemetryLogs}
                            activeAgentsList={activeAgentsList}
                            selectedAgentId={selectedAgentId}
                            setSelectedAgentId={setSelectedAgentId}
                            terminalRef={terminalRef}
                            activeRoomId={activeRoom?.id || null}
                        />
                    </div>

                    {/* DRAG GUTTER */}
                    <div
                        {...gutterProps}
                        className="w-1.5 flex-shrink-0 cursor-col-resize bg-transparent hover:bg-primary/30 active:bg-primary/50 transition-colors relative group z-20"
                    >
                        <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-white/[0.06] group-hover:bg-primary/40 transition-colors" />
                    </div>

                    {/* RIGHT PANE: WORKSPACE CONTENT */}
                    <div style={rightStyle} className="flex flex-col bg-black/20 relative z-0 overflow-hidden">
                        <WorkspaceContentPane
                            activeRoom={activeRoom}
                            activeAgentCount={activeAgentsList.filter(a => a.status === 'online').length}
                            lastUpdated={lastUpdated}
                            content={content}
                        />
                    </div>

                </main>
            </div>
        </div>
    );
}
