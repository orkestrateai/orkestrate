import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { agents, agentSessions, members, workspaces } from "@/db/schema";
import {
  canAccessWorkspace,
  createWorkspaceForUser,
  ensureActiveWorkspaceForUser,
  setActiveWorkspaceForUser,
} from "@/lib/workspaces-core";
import { validateJoinGuard } from "@/lib/git-context";

function nextSessionId() {
  return `sess_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

export type JoinedAgentContext = {
  workspaceId: string;
  sessionId: string;
};

export async function joinWorkspaceForAgent(args: {
  userId: string;
  scopedAgentId: string;
  toolName: string;
  label: string;
  workspaceId?: string | null;
  gitRemote?: string | null;
  normalizedGitRemote?: string | null;
  gitBranch?: string | null;
  gitHeadSha?: string | null;
  repoRoot?: string | null;
  toolNameRaw?: string | null;
}) {
  const now = new Date();
  const requestedWorkspaceId = (args.workspaceId || "").trim();
  let workspaceId =
    requestedWorkspaceId || (await ensureActiveWorkspaceForUser(args.userId));

  if (!workspaceId) {
    const allWorkspaces = await db.query.members.findFirst({
      where: eq(members.userId, args.userId),
    });

    if (!allWorkspaces) {
      // Auto-create workspace if gitRemote is available
      if (args.gitRemote) {
        const repoName =
          args.gitRemote
            .split("/")
            .pop()
            ?.replace(/\.git$/, "") || "Workspace";
        const created = await createWorkspaceForUser(
          args.userId,
          repoName,
          args.gitRemote,
          args.gitBranch || "main",
        );
        if (created.workspace) {
          workspaceId = created.workspace.id;
          await setActiveWorkspaceForUser(args.userId, workspaceId);
        } else {
          return {
            ok: false as const,
            reason:
              "Failed to create workspace: " +
              (created.error || "unknown error"),
          };
        }
      } else {
        return {
          ok: false as const,
          reason:
            "No workspaces found for this account. Please create one in the dashboard first.",
        };
      }
    } else {
      return {
        ok: false as const,
        reason:
          "No active workspace found. Please specify a workspaceId or open a workspace in the dashboard to set it as active.",
      };
    }
  }

  const canJoin = await canAccessWorkspace(args.userId, workspaceId);
  if (!canJoin) {
    return { ok: false as const, reason: "Workspace not accessible." };
  }

  // Git-Rooted Coordination: Join Guard validation
  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.id, workspaceId),
  });

  if (!workspace?.repoUrl) {
    return {
      ok: false as const,
      reason:
        "Workspace missing repository binding. Please connect a Git repository in Workspace Settings to enable orchestration.",
    };
  }

  const guardResult = validateJoinGuard(
    args.gitRemote || null,
    workspace.repoUrl,
  );
  if (!guardResult.allowed) {
    return {
      ok: false as const,
      reason: guardResult.reason || "Repository validation failed.",
      details: {
        agentRepo: guardResult.agentRepo,
        workspaceRepo: guardResult.workspaceRepo,
      },
    };
  }

  await setActiveWorkspaceForUser(args.userId, workspaceId);
  const membership = await db.query.members.findFirst({
    where: and(
      eq(members.userId, args.userId),
      eq(members.workspaceId, workspaceId),
    ),
  });
  if (!membership) {
    return { ok: false as const, reason: "Workspace membership missing." };
  }

  await db
    .insert(agents)
    .values({
      id: args.scopedAgentId,
      memberId: membership.id,
      workspaceId: workspaceId,
      toolName: args.toolName,
      label: args.label,
      status: "active",
      repoUrl: args.gitRemote,
      currentBranch: args.gitBranch,
      lastMessageAt: now,
      pluginConnectedAt: null,
      disconnectedAt: null,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [agents.id],
      set: {
        memberId: membership.id,
        workspaceId: workspaceId,
        toolName: args.toolName,
        label: args.label,
        status: "active",
        repoUrl: args.gitRemote,
        currentBranch: args.gitBranch,
        lastMessageAt: now,
        pluginConnectedAt: null,
        disconnectedAt: null,
        updatedAt: now,
      },
    });

  await db
    .update(agentSessions)
    .set({
      status: "ended",
      endedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(agentSessions.agentId, args.scopedAgentId),
        eq(agentSessions.status, "active"),
      ),
    );

  const sessionId = nextSessionId();
  await db.insert(agentSessions).values({
    id: sessionId,
    agentId: args.scopedAgentId,
    workspaceId: workspaceId,
    status: "active",
    normalizedRemote: args.normalizedGitRemote ?? args.gitRemote,
    repoRoot: args.repoRoot,
    headShaAtJoin: args.gitHeadSha,
    branchAtJoin: args.gitBranch,
    toolNameRaw: args.toolNameRaw,
    startedAt: now,
    endedAt: null,
    lastMessageAt: now,
    transcript: [],
    transcriptUpdatedAt: null,
    createdAt: now,
    updatedAt: now,
  });

  return {
    ok: true as const,
    workspaceId: workspaceId,
    sessionId,
  };
}

export async function getJoinedWorkspaceForAgent(
  userId: string,
  scopedAgentId: string,
): Promise<JoinedAgentContext | null> {
  const joined = await db
    .select({
      id: agents.id,
      workspaceId: agents.workspaceId,
      status: agents.status,
    })
    .from(agents)
    .innerJoin(members, eq(agents.memberId, members.id))
    .where(and(eq(agents.id, scopedAgentId), eq(members.userId, userId)))
    .limit(1);

  const agent = joined[0];
  if (!agent) return null;
  if (agent.status !== "active") return null;

  const activeSession = await db.query.agentSessions.findFirst({
    where: and(
      eq(agentSessions.agentId, scopedAgentId),
      eq(agentSessions.workspaceId, agent.workspaceId),
      eq(agentSessions.status, "active"),
    ),
    orderBy: [desc(agentSessions.startedAt)],
  });

  if (!activeSession) return null;
  return { workspaceId: agent.workspaceId, sessionId: activeSession.id };
}

export async function touchAgentSession(
  scopedAgentId: string,
  sessionId: string,
) {
  const now = new Date();

  await db
    .update(agents)
    .set({
      status: "active",
      lastMessageAt: now,
      disconnectedAt: null,
      updatedAt: now,
    })
    .where(eq(agents.id, scopedAgentId));

  await db
    .update(agentSessions)
    .set({
      status: "active",
      lastMessageAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(agentSessions.id, sessionId),
        eq(agentSessions.agentId, scopedAgentId),
      ),
    );
}

export async function reconcileWorkspaceAgentLiveness() {
  // Session/activity state now comes from plugin events only.
  // Do not auto-disconnect agents on timeouts.
  return 0;
}
