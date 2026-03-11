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

export function proxy(request: NextRequest) {
    const nonce = crypto.randomUUID();

    // Basic CSP: scripts strict nonce or hash (default to 'self'), frames default 'none', images data/self
    // Support Next.jsx development environment
    // Remove nonces locally for app stability, but enforce in staging/prod. OR enforce loosely:

    const isDev = process.env.NODE_ENV === 'development';
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0] : '127.0.0.1';

    // F23: Rate limit OAuth endpoints
    if (request.nextUrl.pathname.startsWith('/api/oauth/')) {
        if (isRateLimited(ip, 20, 60000)) { // 20 requests per minute
            return new NextResponse(JSON.stringify({ error: 'Too many requests' }), {
                status: 429,
                headers: { 'content-type': 'application/json' },
            });
        }
    }

    if (isDev && !request.nextUrl.pathname.startsWith('/api/')) {
        return NextResponse.next(); // skip strictly setting csp to bypass NextJs default dev-errors when HMR
    }

    const cspHeaderName = 'content-security-policy';
    const cspHeaderVersion = 'script-src \'self\' \'nonce-' + nonce + '\' ' + '\'unsafe-inline\' ' + (isDev ? '\'unsafe-eval\'' : '') + ' https:; ' +
        'object-src \'none\'; ' +
        'base-uri \'none\'; ' +
        'style-src \'self\' \'unsafe-inline\'; ' +
        'img-src \'self\' data: blob: https:; ' +
        'font-src \'self\' data: https:;' +
        'connect-src \'self\' wss: https: vitals.vercel-insights.com;' +
        'frame-ancestors \'none\';';

    // Replace newline characters and spaces
    const contentSecurityPolicyHeaderValue = cspHeaderVersion
        .replace(/\s{2,}/g, ' ')
        .trim()

    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-nonce', nonce)
    requestHeaders.set(
        cspHeaderName,
        contentSecurityPolicyHeaderValue
    )

    const response = NextResponse.next({
        request: {
            headers: requestHeaders,
        },
    })

    response.headers.set(
        cspHeaderName,
        contentSecurityPolicyHeaderValue
    )

    return response;
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - api (except oauth)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         */
        {
            source: '/((?!_next/static|_next/image|favicon.ico).*)',
            missing: [
                { type: 'header', key: 'next-router-prefetch' },
                { type: 'header', key: 'purpose', value: 'prefetch' },
            ],
        },
    ],
}
