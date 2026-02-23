import type { NextApiRequest, NextApiResponse } from "next";
import { json } from "@/lib/http";
import { createClient } from "@supabase/supabase-js";
import { getActiveAgentsForProject, getTeamStateForProject } from "@/lib/shared-workspace";
import { getActiveRoomIdForUser, setActiveRoomForUser } from "@/lib/rooms";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        const authHeader = req.headers.authorization;
        let userId: string | null = null;

        if (authHeader?.startsWith("Bearer ")) {
            const token = authHeader.slice(7);
            const supabase = createClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
            );
            const { data: { user } } = await supabase.auth.getUser(token);
            if (user) userId = user.id;
        }

        if (!userId) {
            return json(res, 401, { error: "Unauthorized" });
        }

        if (req.method === "GET") {
            const roomIdFromQuery = typeof req.query.roomId === "string" ? req.query.roomId : null;
            if (roomIdFromQuery) {
                await setActiveRoomForUser(userId, roomIdFromQuery);
            }
            const roomId = roomIdFromQuery || await getActiveRoomIdForUser(userId);
            const { content } = await getTeamStateForProject(userId, roomId);
            const activeAgents = await getActiveAgentsForProject(userId, roomId);
            return json(res, 200, { roomId, content, activeAgentCount: activeAgents.length, activeAgents });
        }

        return json(res, 405, { error: "Method Not Allowed" });
    } catch (error) {
        return json(res, 500, {
            error: "Internal server error",
            detail: error instanceof Error ? error.message : String(error),
        });
    }
}
