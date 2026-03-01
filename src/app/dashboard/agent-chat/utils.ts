import { createSupabaseBrowserClient } from "@/utils/supabase/client";
import type { AgentFamily, DashboardAgent } from "./types";

export const fetcher = async (url: string) => {
    const supabase = createSupabaseBrowserClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error("You must be signed in.");

    const res = await fetch(url, { headers: { Authorization: `Bearer ${session.access_token}` } });
    if (!res.ok) throw new Error(`Failed to load data (${res.status})`);
    return res.json();
};

export function parseMessage(message: string): { type: string; payload: any; raw: any } {
    try {
        const parsed = JSON.parse(message);
        if (parsed && typeof parsed === "object") {
            if (typeof parsed.message === "string") {
                try {
                    const innerParsed = JSON.parse(parsed.message);
                    const eventType = parsed.type || innerParsed.type || "log";
                    return { type: eventType, payload: innerParsed.payload || innerParsed, raw: innerParsed };
                } catch { /* ignored */ }
            }
            const t = typeof parsed.type === "string" ? parsed.type : "log";
            return { type: t, payload: parsed.payload || parsed, raw: parsed };
        }
    } catch { /* ignored */ }
    return { type: "log", payload: message, raw: null };
}

export function formatTs(ts: string): string {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return ts;
    return d.toLocaleString();
}

export function getAgentFamily(agent: DashboardAgent | null): AgentFamily {
    if (!agent) return "other";
    const blob = `${agent.agentId} ${agent.displayName}`.toLowerCase();
    const profile = (agent.agentProfile || "").toLowerCase();
    if (blob.includes("opencode") || profile.includes("opencode")) return "opencode";
    if (blob.includes("claude") || profile.includes("claude")) return "claude";
    if (blob.includes("codex")) return "codex";
    return "other";
}
