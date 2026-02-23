import type { NextApiRequest, NextApiResponse } from "next";
import { json } from "@/lib/http";
import { createClient } from "@supabase/supabase-js";
import { createRoomForUser, deleteRoomForUser, listRoomsForUser, setActiveRoomForUser } from "@/lib/rooms";

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
            if (user) {
                userId = user.id;
            }
        }

        if (!userId) {
            return json(res, 401, { error: "Unauthorized" });
        }

        if (req.method === "GET") {
            const rooms = await listRoomsForUser(userId);
            return json(res, 200, { rooms });
        }

        if (req.method === "POST") {
            const { action, roomId, name } = req.body || {};
            if (action === "create") {
                const room = await createRoomForUser(userId, name);
                return json(res, 200, { room });
            }
            if (action === "switch") {
                if (!roomId) return json(res, 400, { error: "Missing roomId" });
                const ok = await setActiveRoomForUser(userId, roomId);
                if (!ok) return json(res, 403, { error: "Room not accessible" });
                return json(res, 200, { success: true, roomId });
            }
            if (action === "delete") {
                if (!roomId) return json(res, 400, { error: "Missing roomId" });
                const ok = await deleteRoomForUser(userId, roomId);
                if (!ok) return json(res, 403, { error: "Delete not allowed" });
                return json(res, 200, { success: true, roomId });
            }
            return json(res, 400, { error: "Invalid action" });
        }

        return json(res, 405, { error: "Method Not Allowed" });
    } catch (error) {
        return json(res, 500, {
            error: "Internal server error",
            detail: error instanceof Error ? error.message : String(error),
        });
    }
}
