"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Hash, PlusCircle, Settings, Trash2 } from "lucide-react";

import { Navbar } from "@/components/Navbar";
import { AgentTelemetryPane } from "@/components/dashboard/AgentTelemetryPane";
import { WorkspaceContentPane } from "@/components/dashboard/WorkspaceContentPane";
import { useResizablePane } from "@/hooks/useResizablePane";
import { normalizeTelemetryScopedClientId } from "@/lib/agent-identity";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";

type Room = {
  id: string;
  name: string;
  isActive: boolean;
  isOptimistic?: boolean;
};

type TelemetryLog = {
  timestamp: string;
  clientId: string;
  agent: string;
  scopedAgentId: string;
  message: string;
  event: string;
};

type RoomAgentState = {
  stateClientId: string;
  clientBaseId: string;
  agentId: string;
  displayName: string;
  status: "online" | "offline" | "disconnected";
  lastPingAt: string;
  stateHash: string;
  stateContent: Record<string, unknown>;
  stateMarkdown: string;
  agentProfile: string;
  currentObjective: string;
};

type AgentPresence = {
  clientId: string;
  agent: string;
  lastUpdate: string;
  lastMessage: string;
  status: "online" | "offline" | "disconnected";
};

type ActiveAgentListItem = {
  id: string;
  clientId: string;
  agent: string;
  name: string;
  profile?: string;
  lastMessage: string;
  lastUpdate: string;
  status: "online" | "offline" | "disconnected";
};

function toTelemetryLog(raw: any): TelemetryLog {
  const clientId = typeof raw?.clientId === "string" ? raw.clientId : "unknown-client";
  const agent = typeof raw?.agent === "string" ? raw.agent : "unknown-agent";
  return {
    timestamp: typeof raw?.timestamp === "string" ? raw.timestamp : new Date().toISOString(),
    clientId,
    agent,
    scopedAgentId:
      typeof raw?.scopedAgentId === "string"
        ? raw.scopedAgentId
        : normalizeTelemetryScopedClientId(clientId, agent),
    message: typeof raw?.message === "string" ? raw.message : JSON.stringify(raw?.message ?? ""),
    event: typeof raw?.event === "string" ? raw.event : "log",
  };
}

function telemetryKey(log: TelemetryLog) {
  return `${log.timestamp}|${log.scopedAgentId}|${log.event}|${log.message}`;
}

function appendTelemetryLogs(existing: TelemetryLog[], incoming: TelemetryLog[], max = 500) {
  if (incoming.length === 0) return existing;
  const map = new Map<string, TelemetryLog>();
  for (const item of existing) map.set(telemetryKey(item), item);
  for (const item of incoming) map.set(telemetryKey(item), item);
  const merged = Array.from(map.values()).sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
  return merged.slice(-max);
}

function detectLifecycleType(message: string): "connect" | "disconnect" | "heartbeat" | null {
  try {
    const parsed = JSON.parse(message);
    if (parsed?.type === "connect") return "connect";
    if (parsed?.type === "disconnect") return "disconnect";
    if (parsed?.type === "heartbeat") return "heartbeat";
  } catch {
    return null;
  }
  return null;
}

function extractText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map((block: any) => (typeof block?.text === "string" ? block.text : "")).join("\n");
      }
    } catch {
      return value;
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => extractText(entry)).join("\n");
  }
  if (typeof value === "object") {
    const maybeText = (value as any)?.text;
    if (typeof maybeText === "string") return maybeText;
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function extractTelemetryRoomId(raw: any): string | null {
  if (typeof raw?.roomId === "string" && raw.roomId) return raw.roomId;
  if (typeof raw?.message !== "string") return null;
  try {
    const parsed = JSON.parse(raw.message);
    if (typeof parsed?.roomId === "string" && parsed.roomId) return parsed.roomId;
    if (typeof parsed?.payload?.roomId === "string" && parsed.payload.roomId) return parsed.payload.roomId;
  } catch {
    return null;
  }
  return null;
}

function summarizeTelemetryMessage(log: TelemetryLog): string {
  const lifecycle = detectLifecycleType(log.message);
  if (lifecycle === "connect") return "Connected";
  if (lifecycle === "disconnect") return "Disconnected";
  if (lifecycle === "heartbeat") return ""; // Skip — don't overwrite meaningful last message

  try {
    const parsed = JSON.parse(log.message);
    if (parsed?.type === "response_item" && parsed?.payload?.type === "function_call") {
      const toolName =
        typeof parsed.payload?.name === "string" && parsed.payload.name.length > 0
          ? parsed.payload.name
          : "tool";
      return `Running: ${toolName}`;
    }
    if (parsed?.type === "response_item" && parsed?.payload?.type === "message") {
      const text = extractText(parsed.payload?.content);
      return text || "Assistant response";
    }
    if (parsed?.type === "event_msg" && parsed?.payload?.type === "agent_reasoning") {
      return "Thinking...";
    }
    if (parsed?.type === "text") {
      const text = extractText(parsed.payload?.text);
      return text || "Text event";
    }
  } catch {
    // noop
  }

  return log.message?.slice(0, 140) || "Telemetry update";
}

export default function Dashboard() {
  const [user, setUser] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [supabase] = useState(() => createSupabaseBrowserClient());

  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [overviewMarkdown, setOverviewMarkdown] = useState<string>("");
  const [roomAgents, setRoomAgents] = useState<RoomAgentState[]>([]);
  const [counts, setCounts] = useState<{ onlineCount: number; totalCount: number }>({
    onlineCount: 0,
    totalCount: 0,
  });
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);

  const [telemetryLogs, setTelemetryLogs] = useState<TelemetryLog[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const terminalRef = useRef<HTMLDivElement>(null);

  const roomContentReqRef = useRef(0);
  const telemetryReqRef = useRef(0);
  const roomsReqRef = useRef(0);
  const activeRoomIdRef = useRef<string | null>(null);
  const roomsRef = useRef<Room[]>([]);
  const { containerRef, gutterProps, leftStyle, rightStyle } = useResizablePane({
    defaultPercent: 50,
    minPercent: 25,
    maxPercent: 80,
  });

  const activeRoom = useMemo(
    () => rooms.find((room) => room.id === activeRoomId) ?? null,
    [rooms, activeRoomId],
  );

  const switchRoomPreference = useCallback(
    async (roomId: string) => {
      if (!session?.access_token) return;
      await fetch("/api/rooms", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "switch", roomId }),
      });
    },
    [session?.access_token],
  );

  const fetchRooms = useCallback(
    async (reason?: "sync" | "discover") => {
      if (!session?.access_token) return;

      const reqId = ++roomsReqRef.current;
      try {
        const response = await fetch("/api/rooms", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!response.ok) return;

        const data = await response.json();
        if (reqId !== roomsReqRef.current) return;

        const nextRooms: Room[] = Array.isArray(data?.rooms)
          ? data.rooms.map((room: any) => ({
            id: String(room.id),
            name: String(room.name || room.id),
            isActive: Boolean(room.isActive),
          }))
          : [];

        setRooms(nextRooms);

        const activeFromServer = nextRooms.find((room) => room.isActive)?.id ?? null;
        const currentlySelected = activeRoomIdRef.current;
        const hasCurrent = Boolean(currentlySelected && nextRooms.some((room) => room.id === currentlySelected));
        const resolvedActiveId = activeFromServer ?? (hasCurrent ? currentlySelected : nextRooms[0]?.id ?? null);

        if (resolvedActiveId !== activeRoomIdRef.current) {
          setActiveRoomId(resolvedActiveId);
          setSelectedAgentId(null);
        }

        if (!resolvedActiveId) {
          setOverviewMarkdown("");
          setRoomAgents([]);
          setCounts({ onlineCount: 0, totalCount: 0 });
          setTelemetryLogs([]);
          setLastUpdated(null);
        }

        if (!activeFromServer && resolvedActiveId && reason !== "discover") {
          void switchRoomPreference(resolvedActiveId).catch(() => undefined);
        }
      } catch (error) {
        console.error("Failed to fetch rooms:", error);
      }
    },
    [session?.access_token, switchRoomPreference],
  );

  const fetchRoomContent = useCallback(
    async (roomId?: string) => {
      if (!session?.access_token) return;
      const targetRoomId = roomId || activeRoomIdRef.current;
      if (!targetRoomId) return;

      const reqId = ++roomContentReqRef.current;
      try {
        const response = await fetch(`/api/room-content?roomId=${encodeURIComponent(targetRoomId)}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!response.ok) return;

        const data = await response.json();
        if (reqId !== roomContentReqRef.current) return;
        if ((data?.roomId || targetRoomId) !== activeRoomIdRef.current) return;

        if (typeof data?.overviewMarkdown === "string") {
          setOverviewMarkdown(data.overviewMarkdown);
        }

        if (Array.isArray(data?.agents)) {
          setRoomAgents(data.agents as RoomAgentState[]);
        }

        if (typeof data?.counts?.onlineCount === "number" && typeof data?.counts?.totalCount === "number") {
          setCounts({
            onlineCount: data.counts.onlineCount,
            totalCount: data.counts.totalCount,
          });
        } else {
          const agents = Array.isArray(data?.agents) ? (data.agents as RoomAgentState[]) : [];
          const onlineCount = agents.filter((agent) => agent.status === "online").length;
          setCounts({ onlineCount, totalCount: agents.length });
        }

        setLastUpdated(new Date());
      } catch (error) {
        console.error("Failed to fetch room content:", error);
      }
    },
    [session?.access_token],
  );

  const fetchTelemetryHistory = useCallback(
    async (roomId?: string) => {
      if (!session?.access_token) return;
      const targetRoomId = roomId || activeRoomIdRef.current;
      if (!targetRoomId) return;

      const reqId = ++telemetryReqRef.current;
      try {
        const response = await fetch(
          `/api/telemetry-history?sinceHours=24&roomId=${encodeURIComponent(targetRoomId)}`,
          {
            headers: { Authorization: `Bearer ${session.access_token}` },
          },
        );
        if (!response.ok) return;

        const data = await response.json();
        if (reqId !== telemetryReqRef.current) return;
        if ((data?.roomId || targetRoomId) !== activeRoomIdRef.current) return;

        const logs = Array.isArray(data?.logs)
          ? data.logs.map((entry: any) => toTelemetryLog(entry)).slice(-500)
          : [];
        setTelemetryLogs(logs);
      } catch (error) {
        console.error("Failed to fetch telemetry history:", error);
      }
    },
    [session?.access_token],
  );

  const telemetryPresence = useMemo(() => {
    const now = Date.now();
    const staleThresholdMs = 30_000;
    const map = new Map<string, AgentPresence>();

    for (const log of telemetryLogs) {
      const lifecycle = detectLifecycleType(log.message);
      const summary = summarizeTelemetryMessage(log);
      const existing = map.get(log.scopedAgentId);

      if (!existing) {
        map.set(log.scopedAgentId, {
          clientId: log.clientId,
          agent: log.agent,
          lastUpdate: log.timestamp,
          lastMessage: summary,
          status: lifecycle === "disconnect" ? "disconnected" : "online",
        });
        continue;
      }

      if (new Date(log.timestamp).getTime() >= new Date(existing.lastUpdate).getTime()) {
        existing.lastUpdate = log.timestamp;
        if (summary) existing.lastMessage = summary;
        if (lifecycle === "disconnect") existing.status = "disconnected";
        else if (lifecycle === "connect") existing.status = "online";
        // heartbeat: don't change status text, just updates lastUpdate timestamp above
      }
    }

    for (const entry of map.values()) {
      if (entry.status === "disconnected") continue;
      const lastSeen = new Date(entry.lastUpdate).getTime();
      entry.status = now - lastSeen > staleThresholdMs ? "offline" : "online";
    }

    return map;
  }, [telemetryLogs]);

  const activeAgentsList = useMemo(() => {
    const merged = new Map<string, ActiveAgentListItem>();

    for (const stateAgent of roomAgents) {
      const presence = telemetryPresence.get(stateAgent.stateClientId);
      const status: ActiveAgentListItem["status"] =
        presence?.status === "disconnected" || stateAgent.status === "disconnected"
          ? "disconnected"
          : presence?.status === "online" || stateAgent.status === "online"
            ? "online"
            : "offline";

      merged.set(stateAgent.stateClientId, {
        id: stateAgent.stateClientId,
        clientId: stateAgent.clientBaseId,
        agent: stateAgent.agentId,
        name: `@${stateAgent.agentId}`,
        profile: stateAgent.displayName,
        lastMessage: presence?.lastMessage || stateAgent.currentObjective || "No recent updates.",
        lastUpdate: presence?.lastUpdate || stateAgent.lastPingAt,
        status,
      });
    }

    for (const [scopedId, presence] of telemetryPresence.entries()) {
      if (merged.has(scopedId)) continue;
      merged.set(scopedId, {
        id: scopedId,
        clientId: presence.clientId,
        agent: presence.agent,
        name: `@${presence.agent}`,
        lastMessage: presence.lastMessage || "Telemetry connected.",
        lastUpdate: presence.lastUpdate,
        status: presence.status,
      });
    }

    const statusWeight: Record<ActiveAgentListItem["status"], number> = {
      online: 0,
      offline: 1,
      disconnected: 2,
    };

    return Array.from(merged.values()).sort((a, b) => {
      const statusDiff = statusWeight[a.status] - statusWeight[b.status];
      if (statusDiff !== 0) return statusDiff;
      return new Date(b.lastUpdate).getTime() - new Date(a.lastUpdate).getTime();
    });
  }, [roomAgents, telemetryPresence]);

  const selectedAgentState = useMemo(
    () =>
      selectedAgentId
        ? roomAgents.find((agent) => agent.stateClientId === selectedAgentId) ?? null
        : null,
    [roomAgents, selectedAgentId],
  );

  const onlineCount = useMemo(
    () => Math.max(counts.onlineCount, activeAgentsList.filter((agent) => agent.status === "online").length),
    [counts.onlineCount, activeAgentsList],
  );

  const totalCount = useMemo(
    () => Math.max(counts.totalCount, activeAgentsList.length),
    [counts.totalCount, activeAgentsList.length],
  );

  useEffect(() => {
    activeRoomIdRef.current = activeRoomId;
  }, [activeRoomId]);

  useEffect(() => {
    roomsRef.current = rooms;
  }, [rooms]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setSession(data.session ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setUser(nextSession?.user ?? null);
      setSession(nextSession ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (!session?.access_token) {
      setRooms([]);
      setActiveRoomId(null);
      setOverviewMarkdown("");
      setRoomAgents([]);
      setCounts({ onlineCount: 0, totalCount: 0 });
      setTelemetryLogs([]);
      return;
    }

    void fetchRooms("sync");
    const interval = setInterval(() => {
      void fetchRooms("sync");
    }, 8000);

    return () => clearInterval(interval);
  }, [session?.access_token, fetchRooms]);

  useEffect(() => {
    if (!session?.access_token || !activeRoomId || activeRoom?.isOptimistic) return;

    void fetchRoomContent(activeRoomId);
    void fetchTelemetryHistory(activeRoomId);

    const contentInterval = setInterval(() => {
      void fetchRoomContent(activeRoomIdRef.current || undefined);
    }, 2500);

    const historyInterval = setInterval(() => {
      void fetchTelemetryHistory(activeRoomIdRef.current || undefined);
    }, 15000);

    return () => {
      clearInterval(contentInterval);
      clearInterval(historyInterval);
    };
  }, [session?.access_token, activeRoomId, activeRoom?.isOptimistic, fetchRoomContent, fetchTelemetryHistory]);

  useEffect(() => {
    if (!selectedAgentId) return;
    const exists = roomAgents.some((agent) => agent.stateClientId === selectedAgentId);
    const hasTelemetryOnly = activeAgentsList.some((agent) => agent.id === selectedAgentId);
    if (!exists && !hasTelemetryOnly) {
      setSelectedAgentId(null);
    }
  }, [selectedAgentId, roomAgents, activeAgentsList]);

  useEffect(() => {
    const channel = supabase.channel("telemetry:live", {
      config: {
        broadcast: { ack: false },
      },
    });

    channel
      .on("broadcast", { event: "log" }, (rawPayload) => {
        const payload = rawPayload?.payload;
        const telemetryLog = toTelemetryLog(payload);
        const payloadRoomId = extractTelemetryRoomId(payload);

        if (payloadRoomId && !roomsRef.current.some((room) => room.id === payloadRoomId)) {
          void fetchRooms("discover");
        }

        const currentRoomId = activeRoomIdRef.current;
        if (!currentRoomId || (payloadRoomId && payloadRoomId !== currentRoomId)) {
          return;
        }

        setTelemetryLogs((previous) => appendTelemetryLogs(previous, [telemetryLog], 500));

        const lifecycle = detectLifecycleType(telemetryLog.message);
        if (lifecycle === "connect" || lifecycle === "disconnect") {
          void fetchRoomContent(currentRoomId);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, fetchRoomContent, fetchRooms]);

  useEffect(() => {
    if (!terminalRef.current) return;
    terminalRef.current.scrollIntoView({ behavior: "smooth" });
  }, [selectedAgentId, telemetryLogs.length]);

  const handleSwitchRoom = useCallback(
    async (roomId: string) => {
      if (!session?.access_token || roomId === activeRoomIdRef.current) return;

      setRooms((previous) => previous.map((room) => ({ ...room, isActive: room.id === roomId })));
      setActiveRoomId(roomId);
      setSelectedAgentId(null);

      try {
        await switchRoomPreference(roomId);
      } catch (error) {
        console.error("Failed to switch room:", error);
      }

      void fetchRoomContent(roomId);
      void fetchTelemetryHistory(roomId);
      void fetchRooms("sync");
    },
    [session?.access_token, fetchRoomContent, fetchRooms, fetchTelemetryHistory, switchRoomPreference],
  );

  const handleDeleteRoom = useCallback(
    async (roomId: string) => {
      if (!session?.access_token) return;

      const previousRooms = roomsRef.current;
      const remaining = previousRooms.filter((room) => room.id !== roomId);
      const nextActiveId =
        activeRoomIdRef.current === roomId
          ? remaining.find((room) => room.isActive)?.id ?? remaining[0]?.id ?? null
          : activeRoomIdRef.current;

      setRooms(remaining.map((room) => ({ ...room, isActive: room.id === nextActiveId })));
      setActiveRoomId(nextActiveId);
      if (!nextActiveId) {
        setOverviewMarkdown("");
        setRoomAgents([]);
        setCounts({ onlineCount: 0, totalCount: 0 });
        setTelemetryLogs([]);
      }

      try {
        const response = await fetch("/api/rooms", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ action: "delete", roomId }),
        });

        if (!response.ok) {
          throw new Error(`Delete room failed: ${response.status}`);
        }
      } catch (error) {
        console.error(error);
        void fetchRooms("sync");
      }

      if (nextActiveId) {
        void fetchRoomContent(nextActiveId);
        void fetchTelemetryHistory(nextActiveId);
      }
    },
    [session?.access_token, fetchRoomContent, fetchRooms, fetchTelemetryHistory],
  );

  const handleCreateRoom = useCallback(async () => {
    if (!session?.access_token) return;

    const providedName = window.prompt("Room name (optional):", "");
    if (providedName === null) return;

    const optimisticId = `temp_${Date.now().toString(36)}`;
    const optimisticName = providedName.trim() || "New room";

    setLoading(true);
    setRooms((previous) => {
      const reset = previous.map((room) => ({ ...room, isActive: false }));
      return [
        {
          id: optimisticId,
          name: optimisticName,
          isActive: true,
          isOptimistic: true,
        },
        ...reset,
      ];
    });
    setActiveRoomId(optimisticId);
    setSelectedAgentId(null);

    try {
      const response = await fetch("/api/rooms", {
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

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.error || "Failed to create room");
      }

      const data = await response.json();
      const createdRoomId = data?.room?.id;

      await fetchRooms("sync");

      if (createdRoomId) {
        setActiveRoomId(createdRoomId);
        setSelectedAgentId(null);
        void fetchRoomContent(createdRoomId);
        void fetchTelemetryHistory(createdRoomId);
      }
    } catch (error) {
      console.error(error);
      window.alert("Could not create room. Please try again.");
      await fetchRooms("sync");
    } finally {
      setLoading(false);
    }
  }, [session?.access_token, fetchRoomContent, fetchRooms, fetchTelemetryHistory]);

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-black px-4 text-white">
        <p className="mb-4 text-muted-foreground">You must be signed in to view workspaces.</p>
        <Link href="/" className="text-sm font-medium text-foreground hover:underline">
          Return Home
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] min-h-[100dvh] flex-col overflow-hidden bg-black text-foreground">
      <Navbar user={user} handleLogin={() => { }} handleLogout={() => supabase.auth.signOut()} />

      <div className="relative flex h-full flex-1 overflow-hidden pt-[72px]">
        <aside className="relative z-10 hidden w-64 flex-shrink-0 flex-col border-r border-white/[0.06] bg-black/40 backdrop-blur-sm md:flex">
          <div className="flex items-center justify-between border-b border-white/[0.06] p-5">
            <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Workspaces</h2>
            <button
              onClick={handleCreateRoom}
              disabled={loading}
              className="text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
            >
              <PlusCircle className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-2 flex-1 space-y-1 overflow-y-auto p-3">
            {rooms.length === 0 ? (
              <div className="space-y-3 py-6 text-center">
                <p className="text-xs text-muted-foreground">No workspaces found.</p>
                <button
                  onClick={handleCreateRoom}
                  disabled={loading}
                  className="inline-flex items-center gap-2 rounded-md border border-white/[0.08] px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-white/[0.03] hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <PlusCircle className="h-3.5 w-3.5" />
                  Create room
                </button>
              </div>
            ) : (
              rooms.map((room) => (
                <button
                  key={room.id}
                  onClick={() => handleSwitchRoom(room.id)}
                  className={`group flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-sm transition-all ${room.id === activeRoomId
                      ? "border-white/[0.08] bg-white/[0.06] font-medium text-foreground"
                      : "border-transparent text-muted-foreground hover:bg-white/[0.02] hover:text-foreground"
                    }`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Hash className="h-3.5 w-3.5 shrink-0 opacity-60" />
                    <span className="truncate">{room.name || room.id}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {room.id === activeRoomId && <div className="h-1.5 w-1.5 rounded-full bg-primary/80" />}
                    {!room.isOptimistic ? (
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleDeleteRoom(room.id);
                        }}
                        className="cursor-pointer rounded p-1 text-muted-foreground opacity-0 transition-all hover:bg-white/[0.05] hover:text-red-400 group-hover:opacity-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </div>
                    ) : null}
                  </div>
                </button>
              ))
            )}
          </div>

          <div className="border-t border-white/[0.06] p-5">
            <div className="rounded-lg border border-white/[0.05] bg-black/30 p-4 text-xs text-muted-foreground">
              <p className="mb-3 leading-relaxed">
                Agents evaluate the active workspace to coordinate tasks and prevent context shifts.
              </p>
              <div className="flex items-center gap-2 text-muted-foreground/80">
                <Settings className="h-3.5 w-3.5" />
                <span>Auto-sync enabled</span>
              </div>
            </div>
          </div>
        </aside>

        <main ref={containerRef} className="relative z-0 flex min-w-0 flex-1 bg-black/20">
          <div
            style={leftStyle}
            className="relative z-10 flex flex-col overflow-hidden border-r border-white/[0.06] bg-black/40"
          >
            <AgentTelemetryPane
              telemetryLogs={telemetryLogs}
              activeAgentsList={activeAgentsList}
              selectedAgentId={selectedAgentId}
              setSelectedAgentId={setSelectedAgentId}
              terminalRef={terminalRef}
            />
          </div>

          <div
            {...gutterProps}
            className="group relative z-20 w-1.5 flex-shrink-0 cursor-col-resize bg-transparent transition-colors hover:bg-primary/30 active:bg-primary/50"
          >
            <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-white/[0.06] transition-colors group-hover:bg-primary/40" />
          </div>

          <div style={rightStyle} className="relative z-0 flex flex-col overflow-hidden bg-black/20">
            <WorkspaceContentPane
              activeRoom={activeRoom}
              onlineAgentCount={onlineCount}
              totalAgentCount={totalCount}
              lastUpdated={lastUpdated}
              overviewMarkdown={overviewMarkdown}
              selectedAgentState={selectedAgentState}
              onClearSelectedAgent={() => setSelectedAgentId(null)}
            />
          </div>
        </main>
      </div>
    </div>
  );
}
