import { NextRequest, NextResponse } from "next/server";
import { authenticateRequestUser } from "@/lib/auth-user-request";
import { getValidGithubAccessToken } from "@/lib/github-tokens";

export async function GET(req: NextRequest) {
  try {
    const user = await authenticateRequestUser(req);
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Get valid GitHub token (auto-refreshes if expired)
    const tokenResult = await getValidGithubAccessToken(user.id);
    if (!tokenResult.success || !tokenResult.accessToken) {
      return NextResponse.json(
        {
          error:
            tokenResult.error ||
            "GitHub connection required. Please connect GitHub in settings.",
        },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(req.url);
    const owner = searchParams.get("owner");
    const repo = searchParams.get("repo");

    if (!owner || !repo) {
      return NextResponse.json(
        { error: "Missing owner or repo parameter." },
        { status: 400 },
      );
    }

    // Fetch branches from GitHub with persistent token
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/branches?per_page=100`,
      {
        headers: {
          Authorization: `Bearer ${tokenResult.accessToken}`,
          Accept: "application/vnd.github.v3+json",
        },
        next: { revalidate: 3600 }, // Cache for 1 hour
      },
    );

    if (!res.ok) {
      const errorDetail = await res.text();
      console.error("GitHub API error (branches):", errorDetail);
      return NextResponse.json(
        { error: "Failed to fetch branches from GitHub." },
        { status: res.status },
      );
    }

    const branches = await res.json();

    // Normalize response
    const normalized = Array.isArray(branches)
      ? branches.map((b: any) => ({
          name: b.name,
          protected: b.protected,
        }))
      : [];

    return NextResponse.json(
      { branches: normalized },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Branch fetch error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
