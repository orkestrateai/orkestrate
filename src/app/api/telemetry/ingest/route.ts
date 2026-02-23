import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export async function POST(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const clientId = searchParams.get('clientId') || 'unknown';
        const agent = searchParams.get('agent') || 'generic';
        const roomId = searchParams.get('roomId') || 'default';

        const body = await req.json();

        const eventType = body?.type || 'unknown';
        const payloadData = { ...(body?.payload || body), roomId };

        // 1. DB Insert (best-effort, fire-and-forget)
        if (supabase) {
            supabase.from('agent_telemetry').insert({
                client_id: clientId,
                agent: agent,
                event_type: eventType,
                payload: payloadData,
                created_at: new Date().toISOString()
            }).then(({ error }) => {
                if (error) console.error('Supabase DB Insert failed:', error.message);
            });
        }

        // 2. Broadcast via Supabase Realtime REST API
        if (supabaseUrl && supabaseKey) {
            try {
                const broadcastRes = await fetch(`${supabaseUrl}/realtime/v1/api/broadcast`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': supabaseKey,
                        'Authorization': `Bearer ${supabaseKey}`
                    },
                    body: JSON.stringify({
                        messages: [
                            {
                                topic: `telemetry:live`,
                                event: 'log',
                                payload: {
                                    timestamp: new Date().toISOString(),
                                    clientId: clientId,
                                    agent: agent,
                                    roomId: roomId,
                                    ...body
                                }
                            }
                        ]
                    })
                });

                if (!broadcastRes.ok) {
                    console.error('Supabase broadcast failed:', broadcastRes.status);
                }
            } catch (broadcastErr) {
                console.error('Broadcast fetch error:', broadcastErr);
            }
        }

        return new Response('ok', { status: 200 });

    } catch (error) {
        console.error('Telemetry ingestion error:', error);
        return new Response('Internal Server Error', { status: 500 });
    }
}
