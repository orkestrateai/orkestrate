import { NextRequest, NextResponse } from "next/server";
import {
  exchangeCodeForGithubToken,
  storeGithubTokens,
} from "@/lib/github-tokens";
import { authenticateRequestUser } from "@/lib/auth-user-request";

const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID!;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET!;

/**
 * POST /api/oauth/github/token
 *
 * Two modes:
 *
 * 1. Device code polling — body: { device_code: string }
 *    CLI calls this repeatedly after showing user_code to the user.
 *    Returns { access_token, refresh_token, expires_in } on success,
 *    or { error: "authorization_pending" } while the user is still authorize.
 *    Orkestrate proxies the poll to GitHub and stores tokens on success.
 *
 * 2. Direct code exchange — body: { code: string }
 *    For programmatic OAuth flows where a code is available.
 *
 * In both cases Orkestrate stores the GitHub tokens server-side
 * for the authenticated Orkestrate user.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await authenticateRequestUser(req);
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
      return NextResponse.json(
        { error: "GitHub OAuth is not configured on this server" },
        { status: 500 },
      );
    }

    // device_code poll — Orkestrate proxies to GitHub
    const body = (await req.json()) as {
      device_code?: string;
      code?: string;
      user_id?: string;
    };

    if (body.device_code) {
      // Device flow: proxy the poll to GitHub
      const pollRes = await fetch(GITHUB_TOKEN_URL, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: GITHUB_CLIENT_ID,
          client_secret: GITHUB_CLIENT_SECRET,
          device_code: body.device_code,
          grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        }),
      });

      const pollData = (await pollRes.json()) as Record<string, unknown>;

      // "authorization_pending" means user hasn't completed GitHub auth yet
      if (pollData.error === "authorization_pending") {
        return NextResponse.json({ error: "authorization_pending" });
      }

      // "slow_down" means wait longer between polls
      if (pollData.error === "slow_down") {
        return NextResponse.json({ error: "slow_down" });
      }

      if (pollData.error) {
        return NextResponse.json(
          {
            error: pollData.error,
            error_description: pollData.error_description,
          },
          { status: 400 },
        );
      }

      const accessToken = pollData.access_token as string;
      const refreshToken = pollData.refresh_token as string | undefined;
      const expiresIn = pollData.expires_in as number | undefined;

      if (!accessToken) {
        return NextResponse.json(
          {
            error: "no_access_token",
            error_description: "GitHub returned no access token",
          },
          { status: 502 },
        );
      }

      // Store tokens server-side for the authenticated Orkestrate user only
      await storeGithubTokens(
        user.id,
        accessToken,
        refreshToken ?? null,
        expiresIn ?? null,
        pollData.scope as string | null,
      );

      return NextResponse.json({
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_in: expiresIn,
      });
    }

    // Direct code exchange
    if (body.code) {
      const result = await exchangeCodeForGithubToken(body.code);

      if (!result.success || !result.accessToken) {
        return NextResponse.json(
          { error: result.error || "GitHub token exchange failed" },
          { status: 400 },
        );
      }

      await storeGithubTokens(
        user.id,
        result.accessToken,
        result.refreshToken ?? null,
        result.expiresIn ?? null,
        result.scope ?? null,
      );

      return NextResponse.json({
        access_token: result.accessToken,
        refresh_token: result.refreshToken,
        expires_in: result.expiresIn,
      });
    }

    return NextResponse.json(
      { error: "device_code or code is required" },
      { status: 400 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: "internal_error",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
