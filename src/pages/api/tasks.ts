import type { NextApiRequest, NextApiResponse } from "next";
import { json } from "@/lib/http";
import { createClient } from "@supabase/supabase-js";
import { db } from "@/db";
import { tasks, projects } from "@/db/schema";
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
            const status = req.query.status as string | undefined;

            // Fetch projects for this workspace
            const workspaceProjects = await db.select().from(projects).where(eq(projects.roomId, resolvedId));
            const projectIds = workspaceProjects.map(p => p.id);

            if (projectIds.length === 0) {
                return json(res, 200, { tasks: [] });
            }

            const query = db.select()
                .from(tasks)
                .where(and(
                    status ? eq(tasks.status, status) : undefined
                ))
                .orderBy(desc(tasks.createdAt));

            // Drizzle filtering for projectIds needs to be robust if list is large, but for now:
            const allTasks = await query;
            const filtered = allTasks.filter(t => projectIds.includes(t.projectId));

            return json(res, 200, { tasks: filtered });
        }

        if (req.method === "POST") {
            const { action, taskId, title, projectId, status } = req.body || {};

            if (action === "create") {
                if (!title || !projectId) return json(res, 400, { error: "Missing title or projectId" });

                // Verify project belongs to workspace
                const proj = await db.query.projects.findFirst({
                    where: and(eq(projects.id, projectId), eq(projects.roomId, resolvedId))
                });
                if (!proj) return json(res, 403, { error: "Project not in this workspace" });

                const [newTask] = await db.insert(tasks).values({
                    projectId,
                    title,
                    status: status || 'todo',
                }).returning();

                return json(res, 200, { task: newTask });
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
