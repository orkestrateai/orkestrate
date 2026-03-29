import { count, eq, and } from "drizzle-orm";
import { db } from "@/db";
import {
  agents,
  agentSessions,
  members,
  userMcpSettings,
  workspaceInvites,
} from "@/db/schema";
import { hasGithubConnection } from "@/lib/github-tokens";
import { listWorkspacesForUser } from "@/lib/workspaces-core";
import type { OnboardingStatusResponse, OnboardingStepId } from "@/types/onboarding";

function resolveNextStep(input: {
  githubConnected: boolean;
  workspaceReady: boolean;
  mcpPolicyConfigured: boolean;
  hasEverJoinedAgent: boolean;
}): OnboardingStepId {
  if (input.hasEverJoinedAgent) return "completed";
  // GitHub is now optional, so we skip to workspace if it's not connected or we just move on
  if (!input.workspaceReady) return "workspace";
  if (!input.mcpPolicyConfigured) return "mcp-policy";
  return "connect-agent";
}

export async function getOnboardingStatus(
  userId: string,
): Promise<OnboardingStatusResponse> {
  const githubConnected = await hasGithubConnection(userId);

  const workspaceList = await listWorkspacesForUser(userId);
  const activeWorkspaceRow =
    workspaceList.find((workspace) => workspace.isActive) ?? workspaceList[0] ?? null;

  const activeWorkspace = activeWorkspaceRow
    ? {
        id: activeWorkspaceRow.id,
        name: activeWorkspaceRow.name,
        repoUrl: activeWorkspaceRow.repoUrl,
        baseBranch: activeWorkspaceRow.baseBranch,
      }
    : null;

  const workspaceReady = Boolean(activeWorkspace?.repoUrl);

  const [mcpSettingsRow] = await db
    .select({ id: userMcpSettings.id })
    .from(userMcpSettings)
    .where(eq(userMcpSettings.userId, userId))
    .limit(1);
  const mcpPolicyConfigured = Boolean(mcpSettingsRow?.id);

  let inviteCount = 0;
  if (activeWorkspace?.id) {
    const [inviteCountRow] = await db
      .select({ count: count() })
      .from(workspaceInvites)
      .where(eq(workspaceInvites.workspaceId, activeWorkspace.id));
    inviteCount = Number(inviteCountRow?.count ?? 0);
  }

  const [everJoinedRow] = await db
    .select({ count: count() })
    .from(agentSessions)
    .innerJoin(agents, eq(agentSessions.agentId, agents.id))
    .innerJoin(members, eq(agents.memberId, members.id))
    .where(eq(members.userId, userId));
  const hasEverJoinedAgent = Number(everJoinedRow?.count ?? 0) > 0;

  const [activeAgentCountRow] = await db
    .select({ count: count() })
    .from(agentSessions)
    .innerJoin(agents, eq(agentSessions.agentId, agents.id))
    .innerJoin(members, eq(agents.memberId, members.id))
    .where(
      and(eq(members.userId, userId), eq(agentSessions.status, "active")),
    );
  const activeAgentCount = Number(activeAgentCountRow?.count ?? 0);

  const nextStep = resolveNextStep({
    githubConnected,
    workspaceReady,
    mcpPolicyConfigured,
    hasEverJoinedAgent,
  });

  return {
    completed: hasEverJoinedAgent,
    nextStep,
    githubConnected,
    workspaceReady,
    mcpPolicyConfigured,
    inviteCount,
    hasEverJoinedAgent,
    activeAgentCount,
    activeWorkspace,
    steps: [
      { id: "welcome", complete: true },
      { id: "github", complete: githubConnected, optional: true },
      { id: "workspace", complete: workspaceReady },
      { id: "mcp-policy", complete: mcpPolicyConfigured },
      { id: "invite-team", complete: inviteCount > 0, optional: true },
      { id: "connect-agent", complete: hasEverJoinedAgent },
    ],
  };
}
