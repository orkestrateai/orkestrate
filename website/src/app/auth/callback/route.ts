import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (!code) {
    return NextResponse.redirect(new URL(`/login?error=auth_callback_failed`, origin));
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch { /* ignore */ }
        },
      },
    }
  );

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  const session = data?.session;

  // Strict localhost validation to prevent open redirects
  let isDesktop = false;
  try {
    const nextUrl = new URL(next);
    isDesktop = nextUrl.protocol === "orkestrate:"
      || nextUrl.hostname === "localhost"
      || nextUrl.hostname === "127.0.0.1";
  } catch { /* invalid URL */ }

  if (error) {
    if (isDesktop) {
      const errorUrl = new URL(next);
      errorUrl.searchParams.set("error", "auth_failed");
      return NextResponse.redirect(errorUrl);
    }
    return NextResponse.redirect(new URL("/login?error=auth_failed", origin));
  }

  if (isDesktop && session) {
    const redirectUrl = new URL(next);
    redirectUrl.searchParams.set("access_token", session.access_token);
    redirectUrl.searchParams.set("refresh_token", session.refresh_token);
    redirectUrl.searchParams.set("expires_in", String(session.expires_in));
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.redirect(new URL("/", origin));
}
