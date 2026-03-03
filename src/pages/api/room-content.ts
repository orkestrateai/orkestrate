import type { NextApiRequest, NextApiResponse } from "next";
import { json } from "@/lib/http";
import { createClient } from "@supabase/supabase-js";
import { and, desc, eq, gte, inArray, isNull, or } from "drizzle-orm";
import { getDashboardAgentStatesForProject, formatRoomOverviewMarkdown } from "@/lib/shared-workspace";
import { resolveReadableWorkspaceIdForUser } from "@/lib/workspaces";
import { db } from "@/db";
import { agentTelemetry } from "@/db/schema";
import { normalizeTelemetryScopedClientId } from "@/lib/agent-identity";
import { getWorkspaceCanonicalRemote } from "@/lib/repo-identity";
import { listRecentActivity } from "@/lib/agent-activity";

function getLifecycleEventType(payload: any): "connect" | "disconnect" | null {
    const directType = typeof payload?.type === "string" ? payload.type : null;
    if (directType === "connect" || directType === "disconnect") {
        return directType;
    }

    const hookEvent = typeof payload?.hook_event_name === "string" ? payload.hook_event_name : null;
    if (hookEvent === "SessionStart" || hookEvent === "TelemetryConnect") {
        return "connect";
    }
    if (hookEvent === "SessionEnd" || hookEvent === "TelemetryDisconnect") {
        return "disconnect";
    }

    const nestedType = typeof payload?.payload?.type === "string" ? payload.payload.type : null;
    if (nestedType === "connect" || nestedType === "disconnect") {
        return nestedType;
    }

    const message = payload?.message;
    if (typeof message !== "string") return null;
    try {
        const parsed = JSON.parse(message);
        if (parsed?.type === "connect" || parsed?.type === "disconnect") {
            return parsed.type;
        }
    } catch {
        return null;
    }
    return null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        const authHeader = req.headers.authorization;
        let userId: string | null = null;

        if (authHeader?.startsWith("Bearer ")) {
            const token = authHeader.slice(7);
            const supabase = createClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
            );
            const { data: { user } } = await supabase.auth.getUser(token);
            if (user) userId = user.id;
        }

        if (!userId) {
            return json(res, 401, { error: "Unauthorized" });
        }

        if (req.method === "GET") {
            const requestedId = (req.query.workspaceId || req.query.roomId) as string | undefined;
            const { workspaceId, requestedWasAccessible } = await resolveReadableWorkspaceIdForUser(userId, requestedId || null);

            if (requestedId && !requestedWasAccessible) {
                return json(res, 403, { error: "Workspace not accessible" });
            }
            if (!workspaceId) {
                return json(res, 200, {
                    workspaceId: null,
                    roomId: null,
                    overviewMarkdown: "",
                    agents: [],
                    counts: { onlineCount: 0, totalCount: 0 },
                    // Backward compatibility
                    content: "",
                    activeAgentCount: 0,
                    activeAgents: [],
                });
            }

            const workspaceCanonicalRemote = await getWorkspaceCanonicalRemote(workspaceId);
            const dashboardAgents = await getDashboardAgentStatesForProject(userId, workspaceId, {
                workspaceCanonicalRemote,
            });
            const clientBaseIds = Array.from(new Set(dashboardAgents.map((a) => a.clientBaseId).filter(Boolean)));

            const disconnectedScopedIds = new Set<string>();
            if (clientBaseIds.length > 0) {
                const threshold = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                const lifecycleRows = await db
                    .select({
                        scopedAgentId: agentTelemetry.scopedAgentId,
                        payload: agentTelemetry.payload,
                        createdAt: agentTelemetry.createdAt,
                    })
                    .from(agentTelemetry)
                    .where(and(
                        eq(agentTelemetry.roomId, workspaceId),
                        or(
                            eq(agentTelemetry.eventType, "system"),
                            eq(agentTelemetry.eventType, "connect"),
                            eq(agentTelemetry.eventType, "disconnect"),
                            eq(agentTelemetry.eventType, "SessionStart"),
                            eq(agentTelemetry.eventType, "SessionEnd"),
                            eq(agentTelemetry.eventType, "TelemetryConnect"),
                            eq(agentTelemetry.eventType, "TelemetryDisconnect"),
                        ),
                        gte(agentTelemetry.createdAt, threshold),
                        inArray(agentTelemetry.scopedAgentId, clientBaseIds),
                        or(eq(agentTelemetry.userId, userId), isNull(agentTelemetry.userId)),
                    ))
                    .orderBy(desc(agentTelemetry.createdAt));

                const latestLifecycleByScopedId = new Map<string, { lifecycle: "connect" | "disconnect"; createdAt: Date }>();
                for (const row of lifecycleRows) {
                    const lifecycle = getLifecycleEventType(row.payload);
                    if (!lifecycle) continue;
                    const scopedId = row.scopedAgentId;
                    if (latestLifecycleByScopedId.has(scopedId)) continue;
                    latestLifecycleByScopedId.set(scopedId, { lifecycle, createdAt: row.createdAt });
                }

                for (const agent of dashboardAgents) {
                    const latestLifecycle = latestLifecycleByScopedId.get(agent.stateClientId);

                    // An agent is considered explicitly disconnected if:
                    // 1. The latest lifecycle event is "disconnect"
                    // 2. AND that event happened AFTER the most recent heartbeat/ping.
                    // This prevents stale disconnects from overriding new heartbeats.
                    const disconnectedAfterLastPing =
                        latestLifecycle?.lifecycle === "disconnect" &&
                        new Date(latestLifecycle.createdAt).getTime() > new Date(agent.lastPingAt).getTime();

                    if (disconnectedAfterLastPing) {
                        disconnectedScopedIds.add(agent.stateClientId);
                    }
                }
            }

            const agents = dashboardAgents.map((agent) => ({
                ...agent,
                status: disconnectedScopedIds.has(agent.stateClientId) ? "disconnected" as const : agent.status,
            }));
            const overviewMarkdown = formatRoomOverviewMarkdown(
                agents.map((agent) => ({
                    agentDisplayId: agent.agentId,
                    stateContent: agent.stateContent,
                })),
            );
            const onlineCount = agents.filter((agent) => agent.status === "online").length;
            const totalCount = agents.length;
            const recentActivity = await listRecentActivity({ workspaceId, limit: 50 });
            const recentConflicts = recentActivity
                .filter((event) => event.eventType === "conflict_alert")
                .slice(0, 20);

            return json(res, 200, {
                workspaceId,
                roomId: workspaceId,
                workspaceCanonicalRemote,
                overviewMarkdown,
                agents,
                counts: { onlineCount, totalCount },
                recentActivity,
                recentConflicts,
                // Backward compatibility
                content: overviewMarkdown,
                activeAgentCount: onlineCount,
                activeAgents: agents.map((agent) => ({
                    clientId: agent.agentId,
                    stateClientId: agent.stateClientId,
                    projectId: workspaceId,
                    lastPingAt: agent.lastPingAt,
                    stateHash: agent.stateHash,
                    agentProfile: agent.agentProfile,
                    currentObjective: agent.currentObjective,
                })),
            });
        }

        return json(res, 405, { error: "Method Not Allowed" });
    } catch (error) {
        return json(res, 500, {
            error: "Internal server error",
            detail: error instanceof Error ? error.message : String(error),
        });
    }
}
