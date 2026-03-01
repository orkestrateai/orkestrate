import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { agentStates } from "@/db/schema";
import {
  getDisplayAgentIdFromScopedClientId,
  splitScopedClientId,
} from "./agent-identity";
import { normalizeRepoSnapshot, type RepoSnapshot } from "./repo-identity";

const ONLINE_THRESHOLD_MS = 60 * 1000;

export type AgentStateStatus = "active" | "idle" | "blocked";

export type AgentStateContent = {
  status: AgentStateStatus;
  objective: string;
  claimedPaths: string[];
  plan: string[];
  notes: string;
  completed: string[];
  repo: RepoSnapshot;
  agentProfile: string;
};

export type DashboardAgentStatus = "online" | "offline" | "disconnected";

export type DashboardAgentState = {
  stateClientId: string;
  clientBaseId: string;
  agentId: string;
  displayName: string;
  status: DashboardAgentStatus;
  lastPingAt: Date;
  stateHash: string;
  stateContent: AgentStateContent;
  stateMarkdown: string;
  agentProfile: string;
  currentObjective: string;
  codebaseMatch: "matched" | "mismatch" | "unknown";
};

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => Boolean(item));
}

export function normalizeStateContent(stateObj: unknown): AgentStateContent {
  const raw = stateObj && typeof stateObj === "object" && !Array.isArray(stateObj)
    ? (stateObj as Record<string, unknown>)
    : {};

  const objective =
    typeof raw.objective === "string" && raw.objective.trim()
      ? raw.objective.trim()
      : typeof raw.currentObjective === "string" && raw.currentObjective.trim()
        ? raw.currentObjective.trim()
        : "Waiting for tasks";

  const statusRaw =
    typeof raw.status === "string" ? raw.status.trim().toLowerCase() : "";
  const status: AgentStateStatus =
    statusRaw === "blocked"
      ? "blocked"
      : statusRaw === "idle"
        ? "idle"
        : objective.toLowerCase().includes("standing by")
          ? "idle"
          : "active";

  const claimedPaths = normalizeStringList(raw.claimedPaths).length > 0
    ? normalizeStringList(raw.claimedPaths)
    : normalizeStringList(raw.architectureFootprint);

  const plan = normalizeStringList(raw.plan).length > 0
    ? normalizeStringList(raw.plan)
    : normalizeStringList(raw.implementationPlan);

  const notes =
    typeof raw.notes === "string" && raw.notes.trim()
      ? raw.notes.trim()
      : typeof raw.notesForTeam === "string" && raw.notesForTeam.trim()
        ? raw.notesForTeam.trim()
        : "None";

  const completed = normalizeStringList(raw.completed).length > 0
    ? normalizeStringList(raw.completed)
    : normalizeStringList(raw.pastWorkSummary);

  const repo = normalizeRepoSnapshot(raw.repo);

  const agentProfile =
    typeof raw.agentProfile === "string" && raw.agentProfile.trim()
      ? raw.agentProfile.trim()
      : "Agent";

  return {
    status,
    objective,
    claimedPaths,
    plan,
    notes,
    completed,
    repo,
    agentProfile,
  };
}

export function formatSingleAgentStateMarkdown(
  agentDisplayId: string,
  stateObj: AgentStateContent,
): string {
  const claimsMd =
    stateObj.claimedPaths.length > 0
      ? stateObj.claimedPaths.map((p) => `- ${p}`).join("\n")
      : "None";

  const planMd =
    stateObj.plan.length > 0
      ? stateObj.plan.map((p) => `- [ ] ${p}`).join("\n")
      : "None";

  const completedMd =
    stateObj.completed.length > 0
      ? stateObj.completed.map((p) => `- ${p}`).join("\n")
      : "None";

  const repoBits = [
    stateObj.repo.canonicalRemote
      ? `remote=${stateObj.repo.canonicalRemote}`
      : null,
    stateObj.repo.branch ? `branch=${stateObj.repo.branch}` : null,
    stateObj.repo.headSha ? `head=${stateObj.repo.headSha}` : null,
    typeof stateObj.repo.dirty === "boolean"
      ? `dirty=${stateObj.repo.dirty}`
      : null,
  ].filter(Boolean);

  let md = `## [${agentDisplayId}]\n\n`;
  md += `**STATUS:** ${stateObj.status}\n\n`;
  md += `**AGENT_PROFILE:** ${stateObj.agentProfile}\n\n`;
  md += `**OBJECTIVE:** ${stateObj.objective}\n\n`;
  md += `**CLAIMED_PATHS:**\n${claimsMd}\n\n`;
  md += `**PLAN:**\n${planMd}\n\n`;
  md += `**NOTES:**\n- ${stateObj.notes || "None"}\n\n`;
  md += `**COMPLETED:**\n${completedMd}\n\n`;
  md += `**REPO:** ${repoBits.length > 0 ? repoBits.join(" | ") : "Unknown"}`;

  return md;
}

export function formatRoomOverviewMarkdown(
  agents: Array<{ agentDisplayId: string; stateContent: AgentStateContent }>,
): string {
  if (!agents.length) return "";
  return agents
    .map((agent) =>
      formatSingleAgentStateMarkdown(agent.agentDisplayId, agent.stateContent),
    )
    .join("\n\n---\n\n");
}

/**
 * Upsert an agent's heartbeat/state row for a workspace.
 * Rate-limits writes to avoid runaway loops.
 */
export async function upsertAgentState(
  userId: string,
  projectId: string,
  clientId: string,
  stateObj?: Record<string, unknown>,
  expectedStateHash?: string,
) {
  const existing = await db.query.agentStates.findFirst({
    where: and(
      eq(agentStates.userId, userId),
      eq(agentStates.projectId, projectId),
      eq(agentStates.clientId, clientId),
    ),
  });

  const now = new Date();
  const updateData: Record<string, unknown> = { lastPingAt: now };

  if (existing) {
    const windowStart = new Date(existing.windowStartAt);
    const millisecondsSinceWindowStart = now.getTime() - windowStart.getTime();

    if (millisecondsSinceWindowStart < 60000) {
      if (existing.pingCount >= 15) {
        throw new Error(
          "429 Too Many Requests: Rate limit exceeded. You are looping. Sleep for 60 seconds and rethink your approach.",
        );
      }
      updateData.pingCount = existing.pingCount + 1;
    } else {
      updateData.windowStartAt = now;
      updateData.pingCount = 1;
    }
  }

  if (stateObj !== undefined) {
    if (expectedStateHash !== undefined) {
      const currentTeamState = await getTeamStateForProject(userId, projectId);
      if (currentTeamState.stateHash !== expectedStateHash) {
        throw new Error(
          "409 Conflict: Team state changed while you were planning. Call read_agent_state again.",
        );
      }
    }
    const normalized = normalizeStateContent(stateObj);
    updateData.stateContent = normalized;
    updateData.stateHash = Math.random().toString(36).slice(2, 15);
  }

  const fallbackContent = normalizeStateContent(stateObj ?? {});

  await db
    .insert(agentStates)
    .values({
      userId,
      projectId,
      clientId,
      stateContent: fallbackContent,
      stateHash:
        (typeof updateData.stateHash === "string" && updateData.stateHash) ||
        Math.random().toString(36).slice(2, 15),
      lastPingAt: now,
      windowStartAt: existing
        ? ((updateData.windowStartAt as Date) || existing.windowStartAt)
        : now,
      pingCount: existing
        ? ((updateData.pingCount as number) || existing.pingCount)
        : 1,
    })
    .onConflictDoUpdate({
      target: [agentStates.userId, agentStates.projectId, agentStates.clientId],
      set: updateData,
    });
}

export async function getTeamStateForProject(
  userId: string,
  projectId: string,
): Promise<{ content: string; stateHash: string }> {
  void userId;
  const sixtySecondsAgo = new Date(Date.now() - ONLINE_THRESHOLD_MS);

  const activeSessions = await db.query.agentStates.findMany({
    where: eq(agentStates.projectId, projectId),
    orderBy: (states, { asc }) => [asc(states.id)],
  });

  const activeAgents = activeSessions.filter((s) => s.lastPingAt > sixtySecondsAgo);

  if (activeAgents.length === 0) return { content: "", stateHash: "empty" };

  const combinedHash = activeAgents.map((a) => a.stateHash).join("-");

  const formattedContent = formatRoomOverviewMarkdown(
    activeAgents.map((agent) => ({
      agentDisplayId: getDisplayAgentIdFromScopedClientId(agent.clientId),
      stateContent: normalizeStateContent(agent.stateContent),
    })),
  );

  return { content: formattedContent, stateHash: combinedHash };
}

export async function getDashboardAgentStatesForProject(
  userId: string,
  projectId: string,
  options?: {
    disconnectedScopedClientIds?: string[];
    onlineThresholdMs?: number;
    workspaceCanonicalRemote?: string | null;
  },
): Promise<DashboardAgentState[]> {
  void userId;
  const sessions = await db.query.agentStates.findMany({
    where: eq(agentStates.projectId, projectId),
    orderBy: (states, { desc }) => [desc(states.lastPingAt), desc(states.id)],
  });

  const now = Date.now();
  const threshold = options?.onlineThresholdMs ?? ONLINE_THRESHOLD_MS;
  const disconnectedSet = new Set(options?.disconnectedScopedClientIds ?? []);
  const workspaceRemote = (options?.workspaceCanonicalRemote || "").toLowerCase();

  return sessions.map((session) => {
    const parts = splitScopedClientId(session.clientId);
    const stateContent = normalizeStateContent(session.stateContent);
    const isOnline = now - new Date(session.lastPingAt).getTime() <= threshold;
    const status: DashboardAgentStatus = disconnectedSet.has(session.clientId)
      ? "disconnected"
      : isOnline
        ? "online"
        : "offline";

    const displayName =
      stateContent.agentProfile ||
      getDisplayAgentIdFromScopedClientId(session.clientId);
    const agentId =
      parts.scopedAgentId || getDisplayAgentIdFromScopedClientId(session.clientId);

    const agentRemote = (stateContent.repo.canonicalRemote || "").toLowerCase();
    const codebaseMatch: "matched" | "mismatch" | "unknown" =
      workspaceRemote && agentRemote
        ? workspaceRemote === agentRemote
          ? "matched"
          : "mismatch"
        : "unknown";

    return {
      stateClientId: session.clientId,
      clientBaseId: parts.clientBaseId,
      agentId,
      displayName,
      status,
      lastPingAt: session.lastPingAt,
      stateHash: session.stateHash,
      stateContent,
      stateMarkdown: formatSingleAgentStateMarkdown(agentId, stateContent),
      agentProfile: stateContent.agentProfile,
      currentObjective: stateContent.objective,
      codebaseMatch,
    };
  });
}

export async function getExistingAgentState(
  userId: string,
  projectId: string,
  clientId: string,
): Promise<{ stateContent: AgentStateContent; lastPingAt: Date; stateHash: string } | null> {
  const row = await db.query.agentStates.findFirst({
    where: and(
      eq(agentStates.userId, userId),
      eq(agentStates.projectId, projectId),
      eq(agentStates.clientId, clientId),
    ),
  });

  if (!row) return null;

  return {
    stateContent: normalizeStateContent(row.stateContent),
    lastPingAt: row.lastPingAt,
    stateHash: row.stateHash,
  };
}

export async function touchAgentHeartbeat(
  userId: string,
  projectId: string,
  clientId: string,
) {
  const now = new Date();
  await db
    .update(agentStates)
    .set({ lastPingAt: now, windowStartAt: now, pingCount: 1 })
    .where(
      and(
        eq(agentStates.userId, userId),
        eq(agentStates.projectId, projectId),
        eq(agentStates.clientId, clientId),
      ),
    );
}

export async function getActiveAgentsForProject(userId: string, projectId: string) {
  void userId;
  const sixtySecondsAgo = new Date(Date.now() - ONLINE_THRESHOLD_MS);
  const activeSessions = await db.query.agentStates.findMany({
    where: eq(agentStates.projectId, projectId),
    orderBy: (states, { desc }) => [desc(states.lastPingAt)],
  });

  return activeSessions
    .filter((s) => s.lastPingAt > sixtySecondsAgo)
    .map((s) => {
      const stateObj = normalizeStateContent(s.stateContent);
      const agentDisplayId = getDisplayAgentIdFromScopedClientId(s.clientId);
      return {
        clientId: agentDisplayId,
        stateClientId: s.clientId,
        projectId: s.projectId,
        lastPingAt: s.lastPingAt,
        stateHash: s.stateHash,
        agentProfile: stateObj.agentProfile || "Unknown Agent",
        currentObjective: stateObj.objective || "",
      };
    });
}
