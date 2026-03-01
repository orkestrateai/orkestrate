import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { agentSessions, roomMemberships } from '@/db/schema';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const workspaceId = searchParams.get('workspaceId');
        const scopedAgentId = searchParams.get('scopedAgentId');

        if (!workspaceId) {
            return new Response(JSON.stringify({ error: 'Missing workspaceId' }), { status: 400 });
        }

        // 1. Auth check
        const authHeader = req.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
        }

        const token = authHeader.slice(7);
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
        }

        // 2. Room membership check
        const membership = await db.query.roomMemberships.findFirst({
            where: and(
                eq(roomMemberships.roomId, workspaceId),
                eq(roomMemberships.userId, user.id)
            )
        });

        if (!membership) {
            return new Response(JSON.stringify({ error: 'Workspace access denied' }), { status: 403 });
        }

        // 3. Fetch Sessions
        const whereClause = [eq(agentSessions.roomId, workspaceId)];
        if (scopedAgentId) {
            whereClause.push(eq(agentSessions.scopedAgentId, scopedAgentId));
        }

        const sessions = await db.query.agentSessions.findMany({
            where: and(...whereClause),
            orderBy: desc(agentSessions.createdAt),
            limit: 100
        });

        return new Response(JSON.stringify({ sessions }), { status: 200 });

    } catch (error) {
        console.error('Failed to fetch agent sessions:', error);
        return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
    }
}
