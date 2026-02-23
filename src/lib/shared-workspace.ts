import { db } from '@/db';
import { agentStates } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

/**
 * Upsert an agent's heartbeat session for a specific user and project.
 * Optionally checks if the provided expectedStateHash matches the last known hash.
 * Enforces a rate limit of 15 requests per minute per agent.
 */
export async function upsertAgentState(
  userId: string,
  projectId: string,
  clientId: string,
  stateObj?: {
    agentProfile: string,
    currentObjective: string,
    architectureFootprint: string[],
    implementationPlan: string[],
    notesForTeam: string,
    pastWorkSummary?: string[]
  },
  expectedStateHash?: string
) {
  const existing = await db.query.agentStates.findFirst({
    where: and(
      eq(agentStates.userId, userId),
      eq(agentStates.projectId, projectId),
      eq(agentStates.clientId, clientId)
    )
  });

  const now = new Date();
  const updateData: any = { lastPingAt: now };

  // Rate Limiting Logic (Max 15 pings per 60 seconds)
  if (existing) {
    const windowStart = new Date(existing.windowStartAt);
    const millisecondsSinceWindowStart = now.getTime() - windowStart.getTime();

    if (millisecondsSinceWindowStart < 60000) {
      if (existing.pingCount >= 15) {
        throw new Error(`429 Too Many Requests: Rate limit exceeded. You are looping. Sleep for 60 seconds and rethink your approach.`);
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
        throw new Error(`409 Conflict: Team state changed while you were planning. Call read_team_state again.`);
      }
    }
    updateData.stateContent = stateObj; // storing pure JSON
    updateData.stateHash = Math.random().toString(36).substring(2, 15);
  }

  // Verify there's some fallback state before inserting
  const fallbackContent = stateObj ?? {
    agentProfile: 'Idle',
    currentObjective: 'Waiting for tasks',
    architectureFootprint: [],
    implementationPlan: [],
    notesForTeam: 'None'
  };

  await db.insert(agentStates).values({
    userId,
    projectId,
    clientId,
    stateContent: fallbackContent,
    stateHash: updateData.stateHash || Math.random().toString(36).substring(2, 15),
    lastPingAt: now,
    windowStartAt: existing ? (updateData.windowStartAt || existing.windowStartAt) : now,
    pingCount: existing ? (updateData.pingCount || existing.pingCount) : 1
  }).onConflictDoUpdate({
    target: [agentStates.userId, agentStates.projectId, agentStates.clientId],
    set: updateData,
  });
}

/**
 * Get the compiled team state for a given project, along with a cumulative state hash.
 * Formats the combined JSON back into Markdown for reading.
 */
export async function getTeamStateForProject(userId: string, projectId: string): Promise<{ content: string; stateHash: string }> {
  const sixtySecondsAgo = new Date(Date.now() - 60 * 1000);

  const activeSessions = await db.query.agentStates.findMany({
    where: and(
      eq(agentStates.userId, userId),
      eq(agentStates.projectId, projectId)
    ),
    orderBy: (states, { asc }) => [asc(states.id)]
  });

  const activeAgents = activeSessions.filter(s => s.lastPingAt > sixtySecondsAgo);

  if (activeAgents.length === 0) return { content: '', stateHash: 'empty' };

  const combinedHash = activeAgents.map(a => a.stateHash).join('-');

  // Convert JSON to markdown for the unified team read
  const formattedContent = activeAgents.map(agent => {
    const stateObj = agent.stateContent as any;
    if (!stateObj) return `## [${agent.clientId}]\nEmpty State`;

    const footprintMd = stateObj.architectureFootprint && stateObj.architectureFootprint.length > 0
      ? stateObj.architectureFootprint.map((f: string) => `- ${f}`).join('\n')
      : 'None';

    const planMd = stateObj.implementationPlan && stateObj.implementationPlan.length > 0
      ? stateObj.implementationPlan.map((p: string) => `- [ ] ${p}`).join('\n')
      : 'None';

    let md = `## [${agent.clientId}]\n\n`;
    md += `**AGENT_PROFILE:** ${stateObj.agentProfile}\n\n`;
    md += `**CURRENT_OBJECTIVE:** ${stateObj.currentObjective}\n\n`;
    md += `**ARCHITECTURE_FOOTPRINT:**\n${footprintMd}\n\n`;
    md += `**IMPLEMENTATION_PLAN:**\n${planMd}\n\n`;
    md += `**NOTES_FOR_TEAM:**\n- ${stateObj.notesForTeam || 'None'}`;

    if (stateObj.pastWorkSummary && stateObj.pastWorkSummary.length > 0) {
      md += `\n\n**PAST_WORK_SUMMARY:**\n${stateObj.pastWorkSummary.map((w: string) => `- ${w}`).join('\n')}`;
    }
    return md;
  }).join('\n\n---\n\n');

  return { content: formattedContent, stateHash: combinedHash };
}

export async function getActiveAgentsForProject(userId: string, projectId: string) {
  const sixtySecondsAgo = new Date(Date.now() - 60 * 1000);
  const activeSessions = await db.query.agentStates.findMany({
    where: and(
      eq(agentStates.userId, userId),
      eq(agentStates.projectId, projectId)
    ),
    orderBy: (states, { desc }) => [desc(states.lastPingAt)]
  });

  return activeSessions
    .filter((s) => s.lastPingAt > sixtySecondsAgo)
    .map((s) => {
      const stateObj = s.stateContent as any;
      return {
        clientId: s.clientId,
        projectId: s.projectId,
        lastPingAt: s.lastPingAt,
        stateHash: s.stateHash,
        agentProfile: stateObj?.agentProfile || "Unknown Agent",
        currentObjective: stateObj?.currentObjective || "",
      };
    });
}
