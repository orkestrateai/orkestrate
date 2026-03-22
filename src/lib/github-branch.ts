import { githubApiFetch } from "@/lib/github-tokens";

function parseGitHubRepo(
  repoUrl: string,
): { owner: string; repo: string } | null {
  const match = repoUrl.match(/github\.com\/([^/]+)\/([^/.]+)/);
  if (!match) return null;
  return { owner: match[1], repo: match[2].replace(/\.git$/, "") };
}

async function getCommitShaForBranch(
  userId: string,
  owner: string,
  repo: string,
  branch: string,
): Promise<string | null> {
  const res = await githubApiFetch(
    userId,
    `/repos/${owner}/${repo}/branches/${encodeURIComponent(branch)}`,
  );
  if (!res.ok) return null;
  const data = (await res.json()) as { commit?: { sha?: string } };
  return data.commit?.sha ?? null;
}

export async function createWorkspaceBranchOnGitHub(
  userId: string,
  repoUrl: string,
  workspaceId: string,
  baseBranch: string,
): Promise<{ success: boolean; branchName: string; error?: string }> {
  const parsed = parseGitHubRepo(repoUrl);
  if (!parsed) {
    return {
      success: false,
      branchName: "",
      error: "Invalid GitHub repository URL",
    };
  }

  const { owner, repo } = parsed;
  const branchName = `orkestrate/${workspaceId}`;

  const sha = await getCommitShaForBranch(userId, owner, repo, baseBranch);
  if (!sha) {
    return {
      success: false,
      branchName,
      error: `Base branch "${baseBranch}" not found in ${owner}/${repo}`,
    };
  }

  const res = await githubApiFetch(userId, `/repos/${owner}/${repo}/git/refs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha }),
  });

  if (res.ok || res.status === 422) {
    return { success: true, branchName };
  }

  const err = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return {
    success: false,
    branchName,
    error:
      typeof err.message === "string"
        ? err.message
        : "Failed to create branch on GitHub",
  };
}
