import { NextRequest, NextResponse } from "next/server";
import { authenticateRequestUser } from "@/lib/auth-user-request";

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID!;
const GITHUB_DEVICE_CODE_URL = "https://github.com/login/device/code";

/**
 * POST /api/oauth/github/auth-url
 *
 * Initiates GitHub's Device Flow via Orkestrate as the OAuth proxy.
 *
 * Orkestrate proxies the device code request to GitHub, returning:
 *   - device_code: used for polling
 *   - user_code:  short code the user enters at verification_url
 *   - verification_url: where the user enters the code
 *   - interval: minimum seconds between polls
 *   - expires_in: seconds until the code expires
 *
 * The Orkestrate token route (/api/oauth/github/token) handles the poll.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await authenticateRequestUser(req);
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!GITHUB_CLIENT_ID) {
      return NextResponse.json(
        { error: "GitHub OAuth is not configured on this server" },
        { status: 500 },
      );
    }

    // Request device code from GitHub via Orkestrate proxy
    const response = await fetch(GITHUB_DEVICE_CODE_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        scope: "repo read:user",
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json(
        { error: `GitHub device flow failed (${response.status}): ${text}` },
        { status: 502 },
      );
    }

    const data = (await response.json()) as {
      device_code: string;
      user_code: string;
      verification_uri: string;
      expires_in: number;
      interval: number;
    };

    return NextResponse.json({
      device_code: data.device_code,
      user_code: data.user_code,
      verification_uri: data.verification_uri,
      expires_in: data.expires_in,
      interval: data.interval,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Internal server error",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
