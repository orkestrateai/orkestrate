import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { authenticateRequestUser } from "@/lib/auth-user-request";
import { db } from "@/db";
import { agents, members, rooms } from "@/db/schema";

export async function DELETE(req: NextRequest) {
  try {
    const user = await authenticateRequestUser(req);
    if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const agentId = req.nextUrl.searchParams.get("agentId");
    if (!agentId) return NextResponse.json({ error: "Missing agentId" }, { status: 400 });

    // 1. Fetch agent to check ownership
    const agent = await db.query.agents.findFirst({
      where: eq(agents.id, agentId),
    });

    if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

    // 2. Fetch member to verify user
    const member = await db.query.members.findFirst({
      where: eq(members.id, agent.memberId),
    });

    if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });

    // 3. Authorization check
    // Fetch the room to check room owner
    const room = await db.query.rooms.findFirst({
      where: eq(rooms.id, agent.roomId),
    });

    const isAgentOwner = member.userId === user.id;
    const isRoomOwner = room?.ownerUserId === user.id;

    if (!isAgentOwner && !isRoomOwner) {
      return NextResponse.json({ error: "Forbidden: You do not have permission to delete this agent" }, { status: 403 });
    }

    // 4. Perform deletion
    // agentSessions, agentStates, etc. should cascade delete if defined in schema
    await db.delete(agents).where(eq(agents.id, agentId));

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ 
      error: "Internal server error", 
      detail: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
}
