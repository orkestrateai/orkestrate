import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { agents, agentSessions, members, rooms } from "@/db/schema";
import {
  canAccessWorkspace,
  ensureActiveWorkspaceForUser,
  setActiveWorkspaceForUser,
} from "@/lib/workspaces-core";
import { validateJoinGuard } from "@/lib/git-context";

function nextSessionId() {
  return `sess_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

export type JoinedAgentContext = {
  roomId: string;
  sessionId: string;
};

export async function joinWorkspaceForAgent(args: {
  userId: string;
  scopedAgentId: string;
  client: string;
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
  const workspaceId = requestedWorkspaceId || await ensureActiveWorkspaceForUser(args.userId);

  const canJoin = await canAccessWorkspace(args.userId, workspaceId);
  if (!canJoin) {
    return { ok: false as const, reason: "Workspace not accessible." };
  }

  // Git-Rooted Coordination: Join Guard validation
  const room = await db.query.rooms.findFirst({
    where: eq(rooms.id, workspaceId),
  });

  if (!room?.repoUrl) {
    return {
      ok: false as const,
      reason: "Workspace missing repository binding. Please connect a Git repository in Room Settings to enable orchestration.",
    };
  }

  const guardResult = validateJoinGuard(args.gitRemote || null, room.repoUrl);
  if (!guardResult.allowed) {
    return {
      ok: false as const,
      reason: guardResult.reason || "Repository validation failed.",
      details: {
        agentRepo: guardResult.agentRepo,
        roomRepo: guardResult.roomRepo,
      },
    };
  }

  await setActiveWorkspaceForUser(args.userId, workspaceId);
  const membership = await db.query.members.findFirst({
    where: and(eq(members.userId, args.userId), eq(members.roomId, workspaceId)),
  });
  if (!membership) {
    return { ok: false as const, reason: "Workspace membership missing." };
  }

  await db
    .insert(agents)
    .values({
      id: args.scopedAgentId,
      memberId: membership.id,
      roomId: workspaceId,
      client: args.client,
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
        roomId: workspaceId,
        client: args.client,
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
    .where(and(eq(agentSessions.agentId, args.scopedAgentId), eq(agentSessions.status, "active")));

  const sessionId = nextSessionId();
  await db.insert(agentSessions).values({
    id: sessionId,
    agentId: args.scopedAgentId,
    roomId: workspaceId,
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
    roomId: workspaceId,
    sessionId,
  };
}

export async function getJoinedWorkspaceForAgent(userId: string, scopedAgentId: string): Promise<JoinedAgentContext | null> {
  const joined = await db
    .select({
      id: agents.id,
      roomId: agents.roomId,
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
      eq(agentSessions.roomId, agent.roomId),
      eq(agentSessions.status, "active"),
    ),
    orderBy: [desc(agentSessions.startedAt)],
  });

  if (!activeSession) return null;
  return { roomId: agent.roomId, sessionId: activeSession.id };
}

export async function touchAgentSession(scopedAgentId: string, sessionId: string) {
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
    .where(and(eq(agentSessions.id, sessionId), eq(agentSessions.agentId, scopedAgentId)));
}

export async function reconcileWorkspaceAgentLiveness() {
  // Session/activity state now comes from plugin events only.
  // Do not auto-disconnect agents on timeouts.
  return 0;
}
