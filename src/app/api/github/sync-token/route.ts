/**
 * GitHub Token Sync API
 *
 * Syncs the GitHub provider token from Supabase session to our persistent storage.
 * This should be called after login to ensure tokens are available even after session expiry.
 */

import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { storeGithubTokens } from "@/lib/github-tokens";

export const runtime = "nodejs";

export async function POST() {
  try {
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
              // Ignore server component errors
            }
          },
        },
      },
    );

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only sync when the session actually comes from GitHub — a Google
    // provider_token stored here would poison github_tokens and break all
    // GitHub API calls.
    const loginProvider =
      session.user?.app_metadata?.provider ??
      session.user?.app_metadata?.providers?.[0];

    if (loginProvider !== "github") {
      return NextResponse.json(
        { error: "Current session is not a GitHub login" },
        { status: 400 },
      );
    }

    const providerToken = session.provider_token;
    const providerRefreshToken = (session as any).provider_refresh_token;

    if (!providerToken) {
      return NextResponse.json(
        { error: "No GitHub token in session" },
        { status: 400 },
      );
    }

    // Store in persistent storage
    // GitHub OAuth tokens don't have a fixed expiry, but we set a long TTL
    // The token will be refreshed when GitHub API calls fail
    await storeGithubTokens(
      session.user.id,
      providerToken,
      providerRefreshToken || null,
      60 * 60 * 24 * 365, // 1 year expiry (GitHub tokens typically don't expire unless revoked)
      "repo,read:user,user:email",
    );

    return NextResponse.json({
      success: true,
      message: "GitHub token synced successfully",
    });
  } catch (error) {
    console.error("GitHub token sync error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
