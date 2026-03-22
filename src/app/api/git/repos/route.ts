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

    // Fetch from GitHub with persistent token
    const res = await fetch(
      "https://api.github.com/user/repos?sort=updated&per_page=100",
      {
        headers: {
          Authorization: `Bearer ${tokenResult.accessToken}`,
          Accept: "application/vnd.github.v3+json",
        },
        next: { revalidate: 0 },
      },
    );

    if (!res.ok) {
      const errorDetail = await res.text();
      console.error("GitHub API error:", errorDetail);
      return NextResponse.json(
        { error: "Failed to fetch repositories from GitHub" },
        { status: res.status },
      );
    }

    const repos = await res.json();

    // Normalize response
    const normalized = Array.isArray(repos)
      ? repos.map((r: any) => ({
          name: r.name,
          full_name: r.full_name,
          url: r.html_url,
          description: r.description,
          default_branch: r.default_branch,
        }))
      : [];

    return NextResponse.json(
      { repos: normalized },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Repo fetch error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
