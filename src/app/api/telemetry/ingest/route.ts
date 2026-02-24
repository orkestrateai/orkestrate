import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { and, desc, eq, gte, like, or } from 'drizzle-orm';
import { db } from '@/db';
import { agentStates, agentTelemetry, roomMemberships } from '@/db/schema';
import { buildScopedClientId, normalizeTelemetryScopedClientId, sanitizeAgentId, splitScopedClientId } from '@/lib/agent-identity';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const authClient = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

type TelemetryLifecycle = 'connect' | 'disconnect' | 'heartbeat' | null;

function parseTelemetryLifecycle(rawMessage: unknown): TelemetryLifecycle {
    if (typeof rawMessage !== 'string') return null;
    try {
        const parsed = JSON.parse(rawMessage);
        if (parsed?.type === 'connect') return 'connect';
        if (parsed?.type === 'disconnect') return 'disconnect';
        if (parsed?.type === 'heartbeat') return 'heartbeat';
    } catch {
        return null;
    }
    return null;
}

async function inferUserFromRoomMembership(roomId: string): Promise<string | null> {
    try {
        const memberships = await db
            .select({ userId: roomMemberships.userId })
            .from(roomMemberships)
            .where(eq(roomMemberships.roomId, roomId))
            .limit(2);

        if (memberships.length === 1) {
            return memberships[0].userId;
        }
    } catch {
        return null;
    }
    return null;
}

async function resolveTelemetryUserId(
    req: NextRequest,
    clientId: string,
    agent: string,
    roomId: string,
): Promise<string | null> {
    // 1) Prefer explicit user auth token when present.
    const authHeader = req.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ') && authClient) {
        const token = authHeader.slice(7);
        try {
            const { data: { user } } = await authClient.auth.getUser(token);
            if (user?.id) return user.id;
        } catch {
            // Ignore and continue to best-effort fallback.
        }
    }

    // 2) Fallback: infer from recent MCP heartbeat state by client_id.
    const parts = splitScopedClientId(clientId);
    const normalizedAgent = sanitizeAgentId(agent);
    const candidateIds = new Set<string>();
    if (parts.rawClientId) candidateIds.add(parts.rawClientId);
    if (parts.clientBaseId) candidateIds.add(parts.clientBaseId);
    if (parts.clientBaseId && normalizedAgent) {
        candidateIds.add(buildScopedClientId(parts.clientBaseId, normalizedAgent));
    }

    const candidateClauses = Array.from(candidateIds).map((id) => eq(agentStates.clientId, id));
    if (parts.clientBaseId) {
        candidateClauses.push(like(agentStates.clientId, `${parts.clientBaseId}::%`));
    }
    if (candidateClauses.length === 0) return null;

    try {
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const rows = await db
            .select({
                userId: agentStates.userId,
                clientId: agentStates.clientId,
                lastPingAt: agentStates.lastPingAt,
            })
            .from(agentStates)
            .where(and(gte(agentStates.lastPingAt, since), or(...candidateClauses)))
            .orderBy(desc(agentStates.lastPingAt))
            .limit(20);

        if (!rows.length) {
            return await inferUserFromRoomMembership(roomId);
        }

        if (parts.clientBaseId && normalizedAgent) {
            const preferredScoped = buildScopedClientId(parts.clientBaseId, normalizedAgent);
            const exact = rows.find((row) => row.clientId === preferredScoped);
            if (exact?.userId) return exact.userId;
        }

        const exactBase = rows.find((row) => row.clientId === parts.clientBaseId || row.clientId === parts.rawClientId);
        if (exactBase?.userId) return exactBase.userId;

        const inferred = rows[0]?.userId;
        return typeof inferred === 'string' && inferred.length > 0 ? inferred : null;
    } catch {
        return await inferUserFromRoomMembership(roomId);
    }
}

async function touchAgentSessionState(params: {
    userId: string;
    roomId: string;
    clientId: string;
    agent: string;
    lifecycle: TelemetryLifecycle;
}) {
    const scopedClientId = normalizeTelemetryScopedClientId(params.clientId, params.agent);
    const now = new Date();
    const whereClause = and(
        eq(agentStates.userId, params.userId),
        eq(agentStates.projectId, params.roomId),
        eq(agentStates.clientId, scopedClientId),
    );

    const existing = await db.query.agentStates.findFirst({ where: whereClause });

    if (existing) {
        await db.update(agentStates).set({ lastPingAt: now }).where(whereClause);
        return;
    }

    const initialObjective =
        params.lifecycle === 'connect'
            ? 'Agentalk initialized and ready to receive tasks.'
            : 'Waiting for tasks';

    await db.insert(agentStates).values({
        userId: params.userId,
        projectId: params.roomId,
        clientId: scopedClientId,
        stateContent: {
            agentProfile: 'Idle',
            currentObjective: initialObjective,
            architectureFootprint: [],
            implementationPlan: [],
            notesForTeam: 'None',
            pastWorkSummary: [],
        },
        stateHash: Math.random().toString(36).slice(2, 12),
        lastPingAt: now,
        pingCount: 1,
        windowStartAt: now,
    });
}

export async function POST(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const clientId = searchParams.get('clientId') || 'unknown';
        const agent = searchParams.get('agent') || 'generic';
        const roomId = searchParams.get('roomId') || 'unassigned';
        const scopedAgentId = normalizeTelemetryScopedClientId(clientId, agent);

        const parsedBody = await req.json();
        if (!parsedBody || typeof parsedBody !== 'object' || Array.isArray(parsedBody)) {
            return new Response('Invalid payload', { status: 400 });
        }

        let message = typeof parsedBody.message === 'string' ? parsedBody.message : JSON.stringify(parsedBody.message ?? '');
        if (message.length > 200_000) {
            const dropped = message.length - 200_000;
            message = `${message.slice(0, 200_000)}\n...[truncated ${dropped} chars]`;
        }

        let nestedType: string | undefined;
        if (typeof parsedBody.message === 'string') {
            try {
                const nested = JSON.parse(parsedBody.message);
                if (nested && typeof nested.type === 'string') {
                    nestedType = nested.type;
                }
            } catch {
                // Not JSON; expected for plain text logs.
            }
        }

        const eventType =
            (typeof parsedBody.event === 'string' && parsedBody.event) ||
            (typeof parsedBody.type === 'string' && parsedBody.type) ||
            nestedType ||
            'log';

        const payloadData = {
            ...parsedBody,
            message,
            roomId,
            scopedAgentId,
        };

        const createdAt = new Date();
        const createdAtIso = createdAt.toISOString();
        const inferredUserId = await resolveTelemetryUserId(req, clientId, agent, roomId);
        const lifecycle = parseTelemetryLifecycle(message);

        if (inferredUserId && (lifecycle === 'connect' || lifecycle === 'heartbeat' || lifecycle === 'disconnect')) {
            try {
                await touchAgentSessionState({
                    userId: inferredUserId,
                    roomId,
                    clientId,
                    agent,
                    lifecycle,
                });
            } catch (e) {
                console.error('[Telemetry] Failed to upsert agent session state:', e);
            }
        }

        // 1. DB Insert (authoritative path)
        await db.insert(agentTelemetry).values({
            userId: inferredUserId ?? null,
            roomId,
            clientId,
            agent,
            eventType,
            payload: payloadData,
            createdAt,
        });

        // 2. Broadcast via Supabase Realtime REST API (best-effort)
        if (supabaseUrl && supabaseKey) {
            try {
                const broadcastRes = await fetch(`${supabaseUrl}/realtime/v1/api/broadcast`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': supabaseKey,
                        'Authorization': `Bearer ${supabaseKey}`,
                    },
                    body: JSON.stringify({
                        messages: [
                            {
                                topic: 'telemetry:live',
                                event: 'log',
                                payload: {
                                    timestamp: createdAtIso,
                                    clientId,
                                    agent,
                                    roomId,
                                    scopedAgentId,
                                    ...payloadData,
                                },
                            },
                        ],
                    }),
                });
                if (!broadcastRes.ok) {
                    console.error(`[Telemetry] Broadcast failed: ${broadcastRes.status}`);
                }
            } catch (broadcastError) {
                console.error('[Telemetry] Broadcast request failed:', broadcastError);
            }
        }

        return new Response('ok', { status: 200 });

    } catch (error) {
        console.error('Telemetry ingestion error:', error);
        return new Response('Internal Server Error', { status: 500 });
    }
}
