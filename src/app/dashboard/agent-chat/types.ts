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
};

export type ActivityLog = {
    timestamp: string;
    clientId: string;
    agent: string;
    scopedAgentId: string;
    message: string;
    event: string;
    sessionId: string | null;
};

export type ParsedEvent = ActivityLog & {
    parsedType: string;
    payload: any;
    parsedRaw: any;
};

export type SessionRecord = {
    id: string;
    title: string;
    createdAt: string;
    metadata: any;
    status: string;
};

export type AgentFamily = "opencode" | "codex" | "claude" | "other";
