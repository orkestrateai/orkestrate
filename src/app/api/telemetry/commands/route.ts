import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export async function POST(req: NextRequest) {
    if (!supabase) return new Response('Supabase not configured', { status: 500 });

    try {
        const body = await req.json();
        const { targetAgent, message } = body;
        const roomId = body?.roomId || 'default';

        if (!targetAgent || !message) {
            return new Response('Missing targetAgent or message', { status: 400 });
        }

        let clientId = '';
        let agent = '';
        if (typeof targetAgent === 'object' && targetAgent !== null) {
            clientId = String(targetAgent.clientId || '');
            agent = String(targetAgent.agent || '');
        } else if (typeof targetAgent === 'string') {
            // Backward compatibility: legacy `${clientId}-${agentType}` shape
            const lastHyphenIndex = targetAgent.lastIndexOf('-');
            if (lastHyphenIndex > 0) {
                clientId = targetAgent.substring(0, lastHyphenIndex);
                agent = targetAgent.substring(lastHyphenIndex + 1);
            }
        }
        if (!clientId || !agent) {
            return new Response('Invalid targetAgent format. Expected { clientId, agent }', { status: 400 });
        }

        const { error } = await supabase.from('agent_telemetry').insert({
            client_id: clientId,
            agent: agent,
            event_type: 'remote_command',
            payload: { message: message, roomId },
            created_at: new Date().toISOString()
        });

        if (error) {
            console.error('Failed to insert command:', error.message);
            return new Response('Failed to enqueue command', { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (e) {
        console.error('Command queue error:', e);
        return new Response('Internal Server Error', { status: 500 });
    }
}

export async function GET(req: NextRequest) {
    if (!supabase) return new Response('Supabase not configured', { status: 500 });

    try {
        const { searchParams } = new URL(req.url);
        const clientId = searchParams.get('clientId');
        const agent = searchParams.get('agent');
        const roomId = searchParams.get('roomId') || 'default';
        const since = searchParams.get('since');

        if (!clientId || !agent || !since) {
            return new Response('Missing required query params', { status: 400 });
        }

        const { data, error } = await supabase
            .from('agent_telemetry')
            .select('payload, created_at')
            .eq('client_id', clientId)
            .eq('agent', agent)
            .eq('event_type', 'remote_command')
            .contains('payload', { roomId })
            .gt('created_at', since)
            .order('created_at', { ascending: true });

        if (error) {
            console.error('Failed to fetch commands:', error.message);
            return new Response('Failed to load commands', { status: 500 });
        }

        return NextResponse.json({ commands: data });
    } catch (e) {
        console.error('Command fetch error:', e);
        return new Response('Internal Server Error', { status: 500 });
    }
}
