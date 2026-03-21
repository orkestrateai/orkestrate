import { NextRequest, NextResponse } from "next/server";
import { authenticateRequestUser } from "@/lib/auth-user-request";
import { hasGithubConnection } from "@/lib/github-tokens";

/**
 * GET /api/github/status
 *
 * Returns whether the authenticated user has a connected GitHub account.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await authenticateRequestUser(req);
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const connected = await hasGithubConnection(user.id);

    return NextResponse.json({ connected });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error", detail: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
