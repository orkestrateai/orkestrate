import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { ensureActiveWorkspaceForUser } from '@/lib/workspaces'

export const runtime = 'nodejs'

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')
    // if "next" is in param, use it as the redirect URL
    const next = searchParams.get('next') ?? '/'

    if (code) {
        const cookieStore = await cookies()
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    getAll() {
                        return cookieStore.getAll()
                    },
                    setAll(cookiesToSet) {
                        try {
                            cookiesToSet.forEach(({ name, value, options }) =>
                                cookieStore.set(name, value, options)
                            )
                        } catch {
                            // The `setAll` method was called from a Server Component.
                            // This can be ignored if you have middleware refreshing
                            // user sessions.
                        }
                    },
                },
            }
        )

        // Exchange the auth code for a session
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (!error) {
            const { data: { user } } = await supabase.auth.getUser()
            if (user?.id) {
                try {
                    await ensureActiveWorkspaceForUser(user.id)
                } catch (provisionError) {
                    // Do not block login redirect on workspace bootstrap failures.
                    console.error("Failed to ensure active room during auth callback:", provisionError)
                }
            }
            const target = next === "/" ? "/dashboard" : next
            return NextResponse.redirect(`${origin}${target}`)
        }
    }

    // Return the user to an error page with instructions
    return NextResponse.redirect(`${origin}/?error=auth_callback_failed`)
}
