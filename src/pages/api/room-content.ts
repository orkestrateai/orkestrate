import type { NextApiRequest, NextApiResponse } from "next";
import { json } from "@/lib/http";
import { createClient } from "@supabase/supabase-js";
import { and, desc, eq, gte, inArray, isNull, or } from "drizzle-orm";
import { getDashboardAgentStatesForProject, formatRoomOverviewMarkdown } from "@/lib/shared-workspace";
import { resolveReadableRoomIdForUser } from "@/lib/rooms";
import { db } from "@/db";
import { agentTelemetry } from "@/db/schema";
import { normalizeTelemetryScopedClientId } from "@/lib/agent-identity";

function getLifecycleEventType(payload: any): "connect" | "disconnect" | null {
    const message = payload?.message;
    if (typeof message !== "string") return null;
    try {
        const parsed = JSON.parse(message);
        if (parsed?.type === "connect") return "connect";
        if (parsed?.type === "disconnect") return "disconnect";
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
            const roomIdFromQuery = typeof req.query.roomId === "string" ? req.query.roomId : null;
            const { roomId, requestedWasAccessible } = await resolveReadableRoomIdForUser(userId, roomIdFromQuery);
            if (roomIdFromQuery && !requestedWasAccessible) {
                return json(res, 403, { error: "Room not accessible" });
            }
            if (!roomId) {
                return json(res, 200, {
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

            const dashboardAgents = await getDashboardAgentStatesForProject(userId, roomId);
            const clientBaseIds = Array.from(new Set(dashboardAgents.map((a) => a.clientBaseId).filter(Boolean)));

            const disconnectedScopedIds = new Set<string>();
            if (clientBaseIds.length > 0) {
                const threshold = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                const lifecycleRows = await db
                    .select({
                        clientId: agentTelemetry.clientId,
                        agent: agentTelemetry.agent,
                        payload: agentTelemetry.payload,
                        createdAt: agentTelemetry.createdAt,
                    })
                    .from(agentTelemetry)
                    .where(and(
                        eq(agentTelemetry.roomId, roomId),
                        gte(agentTelemetry.createdAt, threshold),
                        inArray(agentTelemetry.clientId, clientBaseIds),
                        or(eq(agentTelemetry.userId, userId), isNull(agentTelemetry.userId)),
                    ))
                    .orderBy(desc(agentTelemetry.createdAt));

                const latestLifecycleByScopedId = new Map<string, "connect" | "disconnect">();
                for (const row of lifecycleRows) {
                    const lifecycle = getLifecycleEventType(row.payload);
                    if (!lifecycle) continue;
                    const scopedId = normalizeTelemetryScopedClientId(row.clientId, row.agent);
                    if (latestLifecycleByScopedId.has(scopedId)) continue;
                    latestLifecycleByScopedId.set(scopedId, lifecycle);
                }

                for (const agent of dashboardAgents) {
                    const lifecycle = latestLifecycleByScopedId.get(agent.stateClientId);
                    if (lifecycle === "disconnect") {
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

            return json(res, 200, {
                roomId,
                overviewMarkdown,
                agents,
                counts: { onlineCount, totalCount },
                // Backward compatibility
                content: overviewMarkdown,
                activeAgentCount: onlineCount,
                activeAgents: agents.map((agent) => ({
                    clientId: agent.agentId,
                    stateClientId: agent.stateClientId,
                    projectId: roomId,
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
