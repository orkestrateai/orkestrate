import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const rateLimitMap = new Map<string, { count: number; lastReset: number }>();

function isRateLimited(ip: string, limit: number, windowMs: number) {
    const now = Date.now();
    const state = rateLimitMap.get(ip) || { count: 0, lastReset: now };

    if (now - state.lastReset > windowMs) {
        state.count = 1;
        state.lastReset = now;
        rateLimitMap.set(ip, state);
        return false;
    }

    state.count += 1;
    rateLimitMap.set(ip, state);
    return state.count > limit;
}

export function middleware(request: NextRequest) {
    const nonce = crypto.randomUUID();

    const isDev = process.env.NODE_ENV === 'development';
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0] : '127.0.0.1';

    // Rate limit OAuth endpoints
    if (request.nextUrl.pathname.startsWith('/api/oauth/')) {
        if (isRateLimited(ip, 20, 60000)) { // 20 requests per minute
            return new NextResponse(JSON.stringify({ error: 'Too many requests' }), {
                status: 429,
                headers: { 'content-type': 'application/json' },
            });
        }
    }

    // Skip CSP in dev for HMR stability if requested, but generally better to keep it
    if (isDev && !request.nextUrl.pathname.startsWith('/api/')) {
        // We still want to provide the nonce for scripts that use it
        const reqHeaders = new Headers(request.headers);
        reqHeaders.set('x-nonce', nonce);
        return NextResponse.next({
            request: { headers: reqHeaders }
        });
    }

    const cspHeaderName = 'content-security-policy';
    
    // Updated CSP to allow Google Fonts and Supabase
    const cspHeaderVersion = `
        default-src 'self';
        script-src 'self' 'nonce-${nonce}' 'unsafe-inline' ${isDev ? "'unsafe-eval'" : ""} https:;
        object-src 'none';
        base-uri 'none';
        style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
        img-src 'self' data: blob: https:;
        font-src 'self' data: https: https://fonts.gstatic.com;
        connect-src 'self' wss: https: vitals.vercel-insights.com;
        frame-ancestors 'none';
    `.replace(/\s{2,}/g, ' ').trim();

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-nonce', nonce);
    requestHeaders.set(cspHeaderName, cspHeaderVersion);

    const response = NextResponse.next({
        request: {
            headers: requestHeaders,
        },
    });

    response.headers.set(cspHeaderName, cspHeaderVersion);

    return response;
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public files (images, etc)
         */
        {
            source: '/((?!_next/static|_next/image|favicon.ico|logo.svg|icon.svg).*)',
            missing: [
                { type: 'header', key: 'next-router-prefetch' },
                { type: 'header', key: 'purpose', value: 'prefetch' },
            ],
        },
    ],
};
