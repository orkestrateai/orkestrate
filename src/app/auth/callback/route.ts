import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { ensureActiveWorkspaceForUser } from "@/lib/workspaces-core";
import { storeGithubTokens } from "@/lib/github-tokens";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // if "next" is in param, use it as the redirect URL
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options),
              );
            } catch {
              // The `setAll` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing
              // user sessions.
            }
          },
        },
      },
    );

    // Exchange the auth code for a session
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Get session immediately after exchange — it contains the provider_token
      const {
        data: { session },
      } = await supabase.auth.getSession();

      // Auto-sync GitHub provider token to our DB so repo access works immediately.
      // Only store when the login provider is actually GitHub — a Google token
      // stored here would poison github_tokens and break all GitHub API calls.
      const loginProvider =
        session?.user?.app_metadata?.provider ??
        session?.user?.app_metadata?.providers?.[0];

      if (session?.provider_token && loginProvider === "github") {
        try {
          await storeGithubTokens(
            session.user.id,
            session.provider_token,
            (session as any).provider_refresh_token ?? null,
            60 * 60 * 24 * 365,
            "repo,read:user,user:email",
          );
        } catch (tokenError) {
          // Non-fatal — don't block login over token sync failure
          console.error("Failed to sync GitHub token on login:", tokenError);
        }
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user?.id) {
        try {
          await ensureActiveWorkspaceForUser(user.id);
        } catch (provisionError) {
          // Do not block login redirect on workspace bootstrap failures.
          console.error(
            "Failed to ensure active workspace during auth callback:",
            provisionError,
          );
        }
      }
      // Preserve OAuth flow - don't redirect to dashboard if coming from /oauth/authorize
      const target = next.startsWith("/oauth/authorize")
        ? next
        : next === "/"
          ? "/dashboard"
          : next;
      return NextResponse.redirect(`${origin}${target}`);
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/?error=auth_callback_failed`);
}
