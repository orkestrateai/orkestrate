import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { db } from "@/db";
import { agents, agentStates, agentSessions, members } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const workspaceId = id;

    // Check if user is a member of this workspace
    const membership = await db.query.members.findFirst({
      where: and(
        eq(members.workspaceId, workspaceId),
        eq(members.userId, user.id),
      ),
    });

    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Fetch active sessions with their latest state
    const sessions = await db.query.agentSessions.findMany({
      where: and(
        eq(agentSessions.workspaceId, workspaceId),
        eq(agentSessions.status, "active"),
      ),
      orderBy: [desc(agentSessions.lastMessageAt)],
    });

    const agentsData = [];
    for (const session of sessions) {
      const state = await db.query.agentStates.findFirst({
        where: eq(agentStates.sessionId, session.id),
      });

      const agentId = session.agentId.split("::")[1] || session.agentId;

      agentsData.push({
        id: session.agentId,
        agentId,
        toolName: session.toolNameRaw || "Unknown",
        status: state?.status || "active",
        objective: state?.objective || "Standing by for next task.",
        footprint: state?.footprint || [],
        plan: state?.plan || [],
        completed: state?.completed || [],
        notes: state?.notes || "",
        branch: state?.gitBranch || session.branchAtJoin,
        headSha: state?.gitHeadSha || session.headShaAtJoin,
        lastMessageAt: session.lastMessageAt.toISOString(),
        updatedAt: (state?.updatedAt || session.updatedAt).toISOString(),
      });
    }

    return NextResponse.json({ agents: agentsData });
  } catch (error) {
    console.error("Error fetching agents:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
