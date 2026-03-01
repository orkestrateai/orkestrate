"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";
import type { ActivityLog, DashboardAgent, ParsedEvent, SessionRecord, Workspace } from "./types";
import { fetcher, getAgentFamily, parseMessage } from "./utils";

/** All data needed by the agent-chat page, driven by SWR polling. */
export function useAgentChatData(selectedAgentId: string) {
    const { data: wsData, error: wsError } = useSWR("/api/workspaces", fetcher, { refreshInterval: 5000 });
    const workspaces: Workspace[] = Array.isArray(wsData?.workspaces) ? wsData.workspaces : Array.isArray(wsData?.rooms) ? wsData.rooms : [];
    const activeWorkspaceId = workspaces.find((w) => w.isActive)?.id || workspaces[0]?.id;

    const { data: contentData } = useSWR(
        activeWorkspaceId ? `/api/room-content?workspaceId=${encodeURIComponent(activeWorkspaceId)}` : null,
        fetcher,
        { refreshInterval: 5000 },
    );
    const agents: DashboardAgent[] = Array.isArray(contentData?.agents) ? contentData.agents : [];

    const selectedAgent = useMemo(() => {
        if (!agents.length) return null;
        if (selectedAgentId) return agents.find((a) => a.stateClientId === selectedAgentId) || null;
        return agents[0] || null;
    }, [agents, selectedAgentId]);

    const sessionsUrl =
        activeWorkspaceId && selectedAgent
            ? `/api/agent-sessions?workspaceId=${encodeURIComponent(activeWorkspaceId)}&scopedAgentId=${encodeURIComponent(selectedAgent.stateClientId)}`
            : null;
    const { data: sessionsData } = useSWR(sessionsUrl, fetcher, { refreshInterval: 5000 });
    const sessions: SessionRecord[] = sessionsData?.sessions || [];

    const { data: telemetryData } = useSWR(
        activeWorkspaceId ? `/api/telemetry-history?workspaceId=${encodeURIComponent(activeWorkspaceId)}&sinceHours=72&includeActivity=true` : null,
        fetcher,
        { refreshInterval: 5000 },
    );
    const rawLogs: ActivityLog[] = Array.isArray(telemetryData?.logs) ? telemetryData.logs : [];

    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

    const logs: ParsedEvent[] = useMemo(() => {
        return rawLogs
            .map((log: any) => {
                const parsed = parseMessage(log.message);
                return { ...log, parsedType: parsed.type, payload: parsed.payload, parsedRaw: parsed.raw, sessionId: log.sessionId };
            })
            .filter((log) => {
                if (["ping", "heartbeat", "connect", "disconnect", "system"].includes(log.parsedType)) return false;
                if (activeSessionId && log.sessionId !== activeSessionId) return false;
                return true;
            });
    }, [rawLogs, activeSessionId]);

    const activeSession = useMemo(() => sessions.find((s) => s.id === activeSessionId) || null, [sessions, activeSessionId]);
    const activeSessionNum = activeSession ? sessions.length - sessions.findIndex((s) => s.id === activeSessionId) : null;
    const agentFamily = getAgentFamily(selectedAgent);

    return {
        loading: !wsData && !wsError,
        activeWorkspaceId,
        selectedAgent,
        sessions,
        logs,
        activeSessionId,
        setActiveSessionId,
        activeSession,
        activeSessionNum,
        agentFamily,
    };
}

/** Sends a prompt to an online agent via the control API. */
export function useSendPrompt() {
    const [composer, setComposer] = useState("");
    const [sending, setSending] = useState(false);

    const send = async (workspaceId: string, scopedAgentId: string, sessionId: string | null) => {
        if (!composer.trim()) return;
        try {
            setSending(true);
            const supabase = createSupabaseBrowserClient();
            const { data: { session } } = await supabase.auth.getSession();
            const res = await fetch("/api/agent-control/send", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token || ""}` },
                body: JSON.stringify({ workspaceId, scopedAgentId, text: composer.trim(), sessionId }),
            });
            if (res.ok) setComposer("");
        } finally {
            setSending(false);
        }
    };

    return { composer, setComposer, sending, send };
}
