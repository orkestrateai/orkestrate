import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { and, desc, eq, gte, like, or, sql } from 'drizzle-orm';
import { db } from '@/db';
import { agents, agentSessions, agentStates, agentTelemetry, roomMemberships } from '@/db/schema';
import {
    buildScopedClientId,
    normalizeTelemetryScopedClientId,
    resolveCanonicalAgentIdentity,
    sanitizeAgentId,
    splitScopedClientId
} from '@/lib/agent-identity';
import { getWorkspaceCanonicalRemote, normalizeCanonicalRemote } from '@/lib/repo-identity';
import {
    computePatchHash,
    detectClaimConflictsForEdit,
    normalizePathLike,
    recordAgentActivity,
    recordConflictAlerts,
} from '@/lib/agent-activity';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const authClient = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

type TelemetryLifecycle = 'connect' | 'disconnect' | 'heartbeat' | null;
type ObservedActivityType = 'file_edit_observed' | 'commit_observed';

type ObservedActivityEvent = {
    eventType: ObservedActivityType;
    payload: Record<string, unknown>;
    repo: Record<string, unknown>;
};

function parseTelemetryLifecycle(body: Record<string, unknown>): TelemetryLifecycle {
    // New format: top-level `type` field
    const topType = body?.type;
    if (topType === 'connect') return 'connect';
    if (topType === 'disconnect') return 'disconnect';
    if (topType === 'heartbeat') return 'heartbeat';

    // Claude Code HTTP hook format: hook_event_name field
    const hookEvent = body?.hook_event_name;
    if (hookEvent === 'SessionStart') return 'connect';
    if (hookEvent === 'SessionEnd') return 'disconnect';

    // New format: `event` field set to 'heartbeat'
    if (body?.event === 'heartbeat') return 'heartbeat';

    // Standalone `telemetry.js` format: structured fields but potentially stringified message
    if (body?.event === 'system' || body?.event === 'log') {
        const payloadData = body.payload ? (body.payload as any) : null;
        if (payloadData?.type === 'connect') return 'connect';
        if (payloadData?.type === 'disconnect') return 'disconnect';
        if (payloadData?.type === 'heartbeat') return 'heartbeat';
    }

    // Legacy format/double stringified: stringified message
    if (typeof body?.message === 'string') {
        try {
            const parsed = JSON.parse(body.message as string);
            if (parsed?.type === 'connect') return 'connect';
            if (parsed?.type === 'disconnect') return 'disconnect';
            if (parsed?.type === 'heartbeat') return 'heartbeat';
        } catch { /* not JSON */ }
    }
    return null;
}

function normalizeRepoObject(input: unknown): Record<string, unknown> {
    if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
    const obj = input as Record<string, unknown>;
    return {
        canonicalRemote: typeof obj.canonicalRemote === 'string' ? obj.canonicalRemote : undefined,
        branch: typeof obj.branch === 'string' ? obj.branch : undefined,
        headSha: typeof obj.headSha === 'string' ? obj.headSha : undefined,
        dirty: typeof obj.dirty === 'boolean' ? obj.dirty : undefined,
    };
}

function maybeExtractActivity(payload: unknown): ObservedActivityEvent | null {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
    const obj = payload as Record<string, unknown>;
    const rawType = typeof obj.type === 'string' ? obj.type : '';
    if (rawType !== 'file_edit_observed' && rawType !== 'commit_observed') {
        return null;
    }

    const payloadObject =
        obj.payload && typeof obj.payload === 'object' && !Array.isArray(obj.payload)
            ? (obj.payload as Record<string, unknown>)
            : {};

    const repo = normalizeRepoObject((obj as any).repo ?? payloadObject.repo);
    return {
        eventType: rawType,
        payload: payloadObject,
        repo,
    };
}

function parseObservedActivityEvents(body: Record<string, unknown>): ObservedActivityEvent[] {
    const events: ObservedActivityEvent[] = [];
    const seen = new Set<string>();
    const pushUnique = (event: ObservedActivityEvent | null) => {
        if (!event) return;
        const key = `${event.eventType}:${JSON.stringify(event.payload)}`;
        if (seen.has(key)) return;
        seen.add(key);
        events.push(event);
    };

    // Primary path: plugin/hook emits event='activity'
    if (body.event === 'activity') {
        pushUnique(maybeExtractActivity(body));
        pushUnique(maybeExtractActivity(body.payload));
    }

    // Secondary path: top-level type-only payload
    pushUnique(maybeExtractActivity(body));

    return events;
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
    const identity = resolveCanonicalAgentIdentity({
        requestedAgentId: agent,
        clientId: parts.clientBaseId,
        clientName: null, // We don't have the client name here usually
    });

    const normalizedAgent = identity.id;
    const candidateIds = new Set<string>();
    if (parts.rawClientId) candidateIds.add(parts.rawClientId);
    if (parts.clientBaseId) candidateIds.add(parts.clientBaseId);
    if (parts.clientBaseId && normalizedAgent) {
        candidateIds.add(buildScopedClientId(parts.clientBaseId, normalizedAgent));
    }

    const candidateClauses = Array.from(candidateIds).map((id) => eq(agentStates.scopedAgentId, id));
    if (parts.clientBaseId) {
        candidateClauses.push(like(agentStates.scopedAgentId, `${parts.clientBaseId}::%`));
    }
    if (candidateClauses.length === 0) return null;

    try {
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const rows = await db
            .select({
                userId: agentStates.userId,
                scopedAgentId: agentStates.scopedAgentId,
                lastPingAt: agentStates.lastPingAt,
            })
            .from(agentStates)
            .where(and(
                eq(agentStates.projectId, roomId),
                gte(agentStates.lastPingAt, since),
                or(...candidateClauses),
            ))
            .orderBy(desc(agentStates.lastPingAt))
            .limit(20);

        if (!rows.length) {
            return await inferUserFromRoomMembership(roomId);
        }

        if (parts.clientBaseId && normalizedAgent) {
            const preferredScoped = buildScopedClientId(parts.clientBaseId, normalizedAgent);
            const exact = rows.find((row) => row.scopedAgentId === preferredScoped);
            if (exact?.userId) return exact.userId;
        }

        const exactBase = rows.find((row) => row.scopedAgentId === parts.clientBaseId || row.scopedAgentId === parts.rawClientId);
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
    const parts = splitScopedClientId(params.clientId);
    const identity = resolveCanonicalAgentIdentity({
        requestedAgentId: params.agent,
        clientId: parts.clientBaseId,
        clientName: null,
    });
    const scopedClientId = buildScopedClientId(parts.clientBaseId, identity.id);
    const now = new Date();

    // 1. Ensure master agent identity exists
    const [agentRecord] = await db.insert(agents).values({
        userId: params.userId,
        projectId: params.roomId,
        scopedAgentId: scopedClientId,
        family: identity.family,
        agentProfile: 'Agent',
    }).onConflictDoUpdate({
        target: [agents.userId, agents.projectId, agents.scopedAgentId],
        set: { updatedAt: now }
    }).returning();

    const whereClause = and(
        eq(agentStates.userId, params.userId),
        eq(agentStates.projectId, params.roomId),
        eq(agentStates.scopedAgentId, scopedClientId),
    );

    const existing = await db.query.agentStates.findFirst({ where: whereClause });

    if (existing) {
        const agentIdToUse = agentRecord?.id || existing.agentId;
        await db.update(agentStates).set({
            lastPingAt: now,
            agentId: agentIdToUse
        }).where(whereClause);
        return agentIdToUse;
    }

    const initialObjective =
        params.lifecycle === 'connect'
            ? 'Orkestrate initialized and ready to receive tasks.'
            : 'Waiting for tasks';

    const [newState] = await db.insert(agentStates).values({
        userId: params.userId,
        projectId: params.roomId,
        scopedAgentId: scopedClientId,
        agentId: agentRecord?.id || null,
        stateContent: {
            status: 'active',
            objective: initialObjective,
            claimedPaths: [],
            plan: [],
            notes: 'None',
            completed: [],
            repo: {},
            agentProfile: 'Agent',
        },
        stateHash: Math.random().toString(36).slice(2, 12),
        lastPingAt: now,
        pingCount: 1,
        windowStartAt: now,
    }).returning();

    return agentRecord?.id || newState.agentId || null;
}

/**
 * Ensures a session record exists in agent_sessions and returns its UUID.
 */
async function resolveOrCreateSession(params: {
    userId: string;
    roomId: string;
    scopedAgentId: string;
    agentId?: string | null;
    externalSessionId?: string;
    sessionTitle?: string;
}): Promise<string | null> {
    const { userId, roomId, scopedAgentId, agentId, externalSessionId, sessionTitle } = params;

    // 1. If we have an externalSessionId (e.g. from OpenCode SQLite), try to find/update it.
    if (externalSessionId) {
        // A. Direct check for existing record with this external ID
        const existing = await db.query.agentSessions.findFirst({
            where: and(
                eq(agentSessions.userId, userId),
                eq(agentSessions.roomId, roomId),
                eq(agentSessions.scopedAgentId, scopedAgentId),
                sql`${agentSessions.metadata}->>'externalSessionId' = ${externalSessionId}`
            )
        });

        if (existing) {
            // Update title if it has changed
            if (sessionTitle && existing.title !== sessionTitle && sessionTitle !== 'New Session') {
                await db.update(agentSessions).set({ title: sessionTitle }).where(eq(agentSessions.id, existing.id));
            }
            return existing.id;
        }

        // B. UPGRADE CHECK: Did we just create a "Heuristic" session for this agent in the last 5 minutes?
        // If so, adopt it instead of creating a new one. This prevents the "pings vs real sessions" split.
        const recentHeuristic = await db.query.agentSessions.findFirst({
            where: and(
                eq(agentSessions.userId, userId),
                eq(agentSessions.roomId, roomId),
                eq(agentSessions.scopedAgentId, scopedAgentId),
                sql`${agentSessions.metadata} IS NULL OR ${agentSessions.metadata}->>'externalSessionId' IS NULL`,
                gte(agentSessions.createdAt, new Date(Date.now() - 5 * 60 * 1000))
            ),
            orderBy: desc(agentSessions.createdAt)
        });

        if (recentHeuristic) {
            await db.update(agentSessions).set({
                metadata: { externalSessionId },
                title: sessionTitle || recentHeuristic.title
            }).where(eq(agentSessions.id, recentHeuristic.id));
            return recentHeuristic.id;
        }

        // C. Not found, attempt insert (watching for race condition)
        try {
            const [inserted] = await db.insert(agentSessions).values({
                userId,
                roomId,
                scopedAgentId,
                title: sessionTitle || 'New Session',
                metadata: { externalSessionId },
                status: 'active',
            }).returning({ id: agentSessions.id });

            return inserted.id;
        } catch (err: any) {
            // If unique violation (23505), someone else just created it. Fetch and return that one.
            if (err?.code === '23505') {
                const raced = await db.query.agentSessions.findFirst({
                    where: and(
                        eq(agentSessions.userId, userId),
                        eq(agentSessions.roomId, roomId),
                        eq(agentSessions.scopedAgentId, scopedAgentId),
                        sql`${agentSessions.metadata}->>'externalSessionId' = ${externalSessionId}`
                    )
                });
                return raced?.id || null;
            }
            throw err;
        }
    }

    // 2. Fallback: No external original ID. Try to find the most recent active session for this agent.
    const recent = await db.query.agentSessions.findFirst({
        where: and(
            eq(agentSessions.userId, userId),
            eq(agentSessions.roomId, roomId),
            eq(agentSessions.scopedAgentId, scopedAgentId),
            eq(agentSessions.status, 'active')
        ),
        orderBy: desc(agentSessions.createdAt)
    });

    // If there's an active session from the last hour, use it.
    if (recent && (Date.now() - recent.createdAt.getTime()) < 60 * 60 * 1000) {
        return recent.id;
    }

    // Otherwise, create a new "Heuristic" session
    const [inserted] = await db.insert(agentSessions).values({
        userId,
        roomId,
        scopedAgentId,
        title: 'New Session',
        status: 'active',
    }).returning({ id: agentSessions.id });

    return inserted.id;
}

export async function POST(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const clientId = searchParams.get('clientId') || 'unknown';
        const agentHint = searchParams.get('agent') || 'generic';
        const roomId = searchParams.get('roomId') || 'unassigned';

        const parts = splitScopedClientId(clientId);
        const identity = resolveCanonicalAgentIdentity({
            requestedAgentId: agentHint,
            clientId: parts.clientBaseId,
            clientName: null,
        });
        const agent = identity.id;
        const scopedAgentId = buildScopedClientId(parts.clientBaseId, agent);

        const parsedBody = await req.json();
        if (!parsedBody || typeof parsedBody !== 'object' || Array.isArray(parsedBody)) {
            return new Response('Invalid payload', { status: 400 });
        }
        const observedActivityEvents = parseObservedActivityEvents(parsedBody as Record<string, unknown>);

        // Extract lifecycle
        const lifecycle = parseTelemetryLifecycle(parsedBody);

        // Resolve User
        const inferredUserId = await resolveTelemetryUserId(req, clientId, agent, roomId);

        // For all phases, touch state and ensure agent ID
        let masterAgentId: string | null = null;
        if (inferredUserId) {
            try {
                masterAgentId = await touchAgentSessionState({ userId: inferredUserId, roomId, clientId: scopedAgentId, agent, lifecycle });
            } catch (e) {
                console.error('[Telemetry] Failed to touch agent state:', e);
            }
        }

        // For heartbeats: we are done
        if (lifecycle === 'heartbeat') {
            return new Response('ok', { status: 200 });
        }

        // Session Resolution (authoritative registration)
        let sessionId: string | null = null;
        if (inferredUserId) {
            // Extract potential session metadata from payload
            // Support both camelCase (OpenCode) and snake_case (Claude Code hooks)
            const externalSessionId =
                parsedBody.sessionID ||
                parsedBody.session_id ||
                (parsedBody.payload as any)?.sessionID ||
                (parsedBody.payload as any)?.session_id ||
                (parsedBody.payload as any)?.properties?.info?.sessionID;

            const sessionTitle =
                parsedBody.sessionTitle ||
                (parsedBody.payload as any)?.sessionTitle;

            try {
                sessionId = await resolveOrCreateSession({
                    userId: inferredUserId,
                    roomId,
                    scopedAgentId,
                    agentId: masterAgentId,
                    externalSessionId,
                    sessionTitle
                });
            } catch (e) {
                console.error('[Telemetry] Session resolution failed:', e);
            }
        }

        // Build final record fields
        // Claude Code hooks use `hook_event_name` (e.g. PostToolUse, SessionStart)
        const eventType =
            (typeof parsedBody.hook_event_name === 'string' && parsedBody.hook_event_name) ||
            (typeof parsedBody.type === 'string' && parsedBody.type) ||
            (typeof parsedBody.event === 'string' && parsedBody.event) ||
            'log';

        let message: string;
        if (typeof parsedBody.message === 'string') {
            message = parsedBody.message;
        } else {
            message = JSON.stringify(parsedBody);
        }
        if (message.length > 200_000) {
            const dropped = message.length - 200_000;
            message = `${message.slice(0, 200_000)}\n...[truncated ${dropped} chars]`;
        }

        const payloadData = {
            ...parsedBody,
            message,
            roomId,
            scopedAgentId,
            sessionId, // Link the DB UUID
        };

        const createdAt = new Date();

        // DB Insert
        await db.insert(agentTelemetry).values({
            userId: inferredUserId ?? null,
            roomId,
            scopedAgentId,
            agentId: masterAgentId || null,
            sessionId: sessionId as any, // Drizzle type cast
            eventType,
            payload: payloadData as any,
            createdAt,
        });

        const workspaceCanonicalRemote = observedActivityEvents.length > 0
            ? normalizeCanonicalRemote(await getWorkspaceCanonicalRemote(roomId))
            : null;

        if (observedActivityEvents.length > 0) {
            for (const activity of observedActivityEvents) {
                const payload = { ...activity.payload };
                const repo = activity.repo || {};
                const receivedRemote = normalizeCanonicalRemote(
                    typeof repo.canonicalRemote === 'string' ? repo.canonicalRemote : null,
                );

                if (
                    workspaceCanonicalRemote &&
                    receivedRemote &&
                    workspaceCanonicalRemote !== receivedRemote
                ) {
                    await recordAgentActivity({
                        workspaceId: roomId,
                        scopedAgentId,
                        agentId: masterAgentId,
                        sessionId,
                        eventType: 'conflict_alert',
                        repo,
                        payload: {
                            type: 'codebase_mismatch',
                            sourceEventType: activity.eventType,
                            expectedCanonicalRemote: workspaceCanonicalRemote,
                            receivedCanonicalRemote: receivedRemote,
                        },
                    });
                    continue;
                }

                if (activity.eventType === 'file_edit_observed') {
                    const editObj = (payload.edit && typeof payload.edit === 'object' && !Array.isArray(payload.edit))
                        ? (payload.edit as Record<string, unknown>)
                        : payload;
                    const normalizedPath = normalizePathLike(editObj.path);

                    const sanitizedEdit = {
                        path: normalizedPath || '',
                        operation:
                            typeof editObj.operation === 'string'
                                ? editObj.operation
                                : 'unknown',
                        lineStart:
                            typeof editObj.lineStart === 'number' ? editObj.lineStart : undefined,
                        lineEnd:
                            typeof editObj.lineEnd === 'number' ? editObj.lineEnd : undefined,
                        snippet:
                            typeof editObj.snippet === 'string'
                                ? editObj.snippet.slice(0, 300)
                                : undefined,
                        patchHash:
                            typeof editObj.patchHash === 'string' && editObj.patchHash
                                ? editObj.patchHash
                                : computePatchHash(JSON.stringify(editObj)),
                    };

                    const activityRow = await recordAgentActivity({
                        workspaceId: roomId,
                        scopedAgentId,
                        agentId: masterAgentId,
                        sessionId,
                        eventType: 'file_edit_observed',
                        repo,
                        payload: {
                            ...payload,
                            edit: sanitizedEdit,
                        },
                    });

                    if (normalizedPath) {
                        const conflicts = await detectClaimConflictsForEdit({
                            workspaceId: roomId,
                            scopedAgentId,
                            editPath: normalizedPath,
                        });
                        if (conflicts.length > 0) {
                            await recordConflictAlerts({
                                workspaceId: roomId,
                                scopedAgentId,
                                agentId: masterAgentId,
                                sessionId,
                                editPath: normalizedPath,
                                conflicts,
                                repo,
                            });
                        }
                    }

                    // Keep best-effort reference for live broadcasts
                    (payload as any).__activityId = activityRow?.id;
                } else if (activity.eventType === 'commit_observed') {
                    const commitObj =
                        payload.commit && typeof payload.commit === 'object' && !Array.isArray(payload.commit)
                            ? (payload.commit as Record<string, unknown>)
                            : payload;

                    await recordAgentActivity({
                        workspaceId: roomId,
                        scopedAgentId,
                        agentId: masterAgentId,
                        sessionId,
                        eventType: 'commit_observed',
                        repo,
                        payload: {
                            ...payload,
                            commit: {
                                sha: typeof commitObj.sha === 'string' ? commitObj.sha : '',
                                message:
                                    typeof commitObj.message === 'string'
                                        ? commitObj.message.slice(0, 500)
                                        : '',
                                changedPaths: Array.isArray(commitObj.changedPaths)
                                    ? commitObj.changedPaths
                                        .map((p) => (typeof p === 'string' ? p : ''))
                                        .filter((p) => Boolean(p))
                                        .slice(0, 200)
                                    : [],
                            },
                        },
                    });
                }
            }
        }

        // Broadcast BEST EFFORT
        if (supabaseUrl && supabaseKey) {
            try {
                await fetch(`${supabaseUrl}/realtime/v1/api/broadcast`, {
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
                                    timestamp: createdAt.toISOString(),
                                    clientId,
                                    agent,
                                    roomId,
                                    scopedAgentId,
                                    sessionId,
                                    ...payloadData,
                                },
                            },
                        ],
                    }),
                });
            } catch (err) {
                console.error('[Telemetry] Broadcast failed:', err);
            }
        }

        return new Response('ok', { status: 200 });

    } catch (error) {
        console.error('Telemetry ingestion error:', error);
        return new Response('Internal Server Error', { status: 500 });
    }
}
