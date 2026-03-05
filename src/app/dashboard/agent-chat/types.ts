"use client";

export type Workspace = { id: string; isActive?: boolean };

export type DashboardAgent = {
    stateClientId: string;
    clientBaseId: string;
    agentId: string;
    displayName: string;
    status: "online" | "offline" | "disconnected";
    lastPingAt: string;
    agentProfile: string;
    currentObjective: string;
    pluginConnected?: boolean;
    activeSessionId?: string | null;
    canViewChat?: boolean;
};

export type TranscriptEntry = {
    timestamp: string;
    type: string;
    payload: any;
    message: string;
};

export type SessionRecord = {
    id: string;
    title: string;
    createdAt: string;
    status: string;
};
