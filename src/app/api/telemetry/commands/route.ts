import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
    void req;
    return new Response('Two-way command relay is disabled on this branch.', { status: 410 });
}

export async function GET(req: NextRequest) {
    void req;
    return new Response('Two-way command relay is disabled on this branch.', { status: 410 });
}
