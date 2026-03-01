import type { NextApiRequest, NextApiResponse } from "next";
import { json } from "@/lib/http";
import { createClient } from "@supabase/supabase-js";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { resolveReadableWorkspaceIdForUser } from "@/lib/workspaces";

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

        if (!userId) return json(res, 401, { error: "Unauthorized" });

        const workspaceId = (req.query.workspaceId || req.query.roomId) as string | undefined;
        const { workspaceId: resolvedId, requestedWasAccessible } = await resolveReadableWorkspaceIdForUser(userId, workspaceId || null);

        if (workspaceId && !requestedWasAccessible) {
            return json(res, 403, { error: "Workspace not accessible" });
        }
        if (!resolvedId) return json(res, 400, { error: "No active workspace" });

        if (req.method === "GET") {
            const workspaceProjects = await db.select()
                .from(projects)
                .where(eq(projects.roomId, resolvedId))
                .orderBy(desc(projects.createdAt));

            return json(res, 200, { projects: workspaceProjects });
        }

        if (req.method === "POST") {
            const { action, name, description } = req.body || {};

            if (action === "create") {
                if (!name) return json(res, 400, { error: "Missing name" });

                const [newProject] = await db.insert(projects).values({
                    roomId: resolvedId,
                    name,
                    description: description || "",
                    status: 'active',
                }).returning();

                return json(res, 200, { project: newProject });
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
