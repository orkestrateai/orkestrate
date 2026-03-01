import type { NextApiRequest, NextApiResponse } from "next";
import { json } from "@/lib/http";
import { createClient } from "@supabase/supabase-js";
import {
  createWorkspaceForUser,
  deleteWorkspaceForUser,
  ensureActiveWorkspaceForUser,
  listWorkspacesForUser,
  renameWorkspaceForUser,
  setActiveWorkspaceForUser,
} from "@/lib/workspaces";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const authHeader = req.headers.authorization;
    let userId: string | null = null;

    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) userId = user.id;
    }

    if (!userId) return json(res, 401, { error: "Unauthorized" });

    if (req.method === "GET") {
      await ensureActiveWorkspaceForUser(userId);
      const workspaces = await listWorkspacesForUser(userId);
      return json(res, 200, { workspaces, rooms: workspaces });
    }

    if (req.method === "POST") {
      const { action, workspaceId, roomId, name } = req.body || {};
      const targetId = workspaceId || roomId;

      if (action === "create") {
        const workspace = await createWorkspaceForUser(userId, name);
        return json(res, 200, { workspace, room: workspace });
      }
      if (action === "switch") {
        if (!targetId) return json(res, 400, { error: "Missing workspaceId" });
        const ok = await setActiveWorkspaceForUser(userId, targetId);
        if (!ok) return json(res, 403, { error: "Workspace not accessible" });
        return json(res, 200, { success: true, workspaceId: targetId, roomId: targetId });
      }
      if (action === "delete") {
        if (!targetId) return json(res, 400, { error: "Missing workspaceId" });
        const ok = await deleteWorkspaceForUser(userId, targetId);
        if (!ok) return json(res, 403, { error: "Delete not allowed" });
        return json(res, 200, { success: true, workspaceId: targetId, roomId: targetId });
      }
      if (action === "rename") {
        if (!targetId) return json(res, 400, { error: "Missing workspaceId" });
        if (typeof name !== "string" || !name.trim()) return json(res, 400, { error: "Missing name" });
        const ok = await renameWorkspaceForUser(userId, targetId, name);
        if (!ok) return json(res, 403, { error: "Rename not allowed" });
        return json(res, 200, { success: true, workspaceId: targetId, roomId: targetId, name: name.trim() });
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

