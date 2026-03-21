import { NextRequest, NextResponse } from "next/server";
import { authenticateRequestUser } from "@/lib/auth-user-request";
import { deleteGithubTokens } from "@/lib/github-tokens";

/**
 * DELETE /api/github/token
 *
 * Disconnects the user's GitHub account by deleting stored tokens.
 */
export async function DELETE(req: NextRequest) {
  try {
    const user = await authenticateRequestUser(req);
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await deleteGithubTokens(user.id);

    return NextResponse.json({ success: true });
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
