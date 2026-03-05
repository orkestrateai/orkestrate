"use client";

import { useState } from "react";
import useSWR from "swr";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";
import type { DashboardAgent, SessionRecord, TranscriptEntry, Workspace } from "./types";
import { fetcher } from "./utils";

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

    const selectedAgent = (() => {
        if (!agents.length) return null;
        if (selectedAgentId) {
            const exact = agents.find((a) => a.stateClientId === selectedAgentId);
            if (exact) return exact;
            const byLabel = agents.find((a) => a.agentId === selectedAgentId || a.displayName === selectedAgentId);
            if (byLabel) return byLabel;
        }
        return agents.find((a) => a.status === "online") || agents[0] || null;
    })();

    const activeSessionId = selectedAgent?.activeSessionId || null;
    const sessions: SessionRecord[] = activeSessionId
        ? [{ id: activeSessionId, title: "Active Session", createdAt: new Date().toISOString(), status: "active" }]
        : [];

    const transcriptUrl =
        activeWorkspaceId && selectedAgent
            ? `/api/agent-sessions?workspaceId=${encodeURIComponent(activeWorkspaceId)}&scopedAgentId=${encodeURIComponent(selectedAgent.stateClientId)}&activeOnly=true`
            : null;
    const { data: transcriptData } = useSWR(transcriptUrl, fetcher, { refreshInterval: 3000 });
    const logs: TranscriptEntry[] = Array.isArray(transcriptData?.logs) ? transcriptData.logs : [];

    const activeSession = sessions.find((s) => s.id === activeSessionId) || null;

    return {
        loading: !wsData && !wsError,
        activeWorkspaceId,
        selectedAgent,
        sessions,
        logs,
        activeSessionId,
        activeSession,
    };
}

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
