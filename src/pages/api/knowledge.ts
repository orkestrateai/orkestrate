import type { NextApiRequest, NextApiResponse } from "next";
import { json } from "@/lib/http";
import { createClient } from "@supabase/supabase-js";
import { db } from "@/db";
import { knowledgeDocs } from "@/db/schema";
import { and, eq } from "drizzle-orm";
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

        if (!userId) {
            return json(res, 401, { error: "Unauthorized" });
        }

        if (req.method === "GET") {
            const requestedWorkspaceId = req.query.workspaceId as string | undefined;
            const { workspaceId, requestedWasAccessible } = await resolveReadableWorkspaceIdForUser(userId, requestedWorkspaceId || null);

            if (requestedWorkspaceId && !requestedWasAccessible) {
                return json(res, 403, { error: "Workspace not accessible" });
            }

            if (!workspaceId) {
                return json(res, 200, { docs: [] });
            }

            const docId = req.query.id as string | undefined;

            if (docId) {
                // Get single doc
                const doc = await db.query.knowledgeDocs.findFirst({
                    where: and(
                        eq(knowledgeDocs.workspaceId, workspaceId),
                        eq(knowledgeDocs.id, docId)
                    )
                });
                return json(res, 200, { doc });
            }

            // List all docs for the workspace
            const allDocs = await db.query.knowledgeDocs.findMany({
                where: eq(knowledgeDocs.workspaceId, workspaceId),
                orderBy: (docs, { asc }) => [asc(docs.title)]
            });

            return json(res, 200, { docs: allDocs });
        }

        if (req.method === "POST") {
            const { workspaceId, title, description, content, parentId, isFolder } = req.body;

            const { requestedWasAccessible } = await resolveReadableWorkspaceIdForUser(userId, workspaceId);
            if (!requestedWasAccessible) {
                return json(res, 403, { error: "Workspace not accessible" });
            }

            const [newDoc] = await db.insert(knowledgeDocs).values({
                workspaceId,
                title,
                description: description || "",
                content: content || "",
                parentId: parentId || null,
                isFolder: !!isFolder,
            }).returning();

            return json(res, 201, { doc: newDoc });
        }

        if (req.method === "PUT") {
            const { id, workspaceId, title, description, content, parentId } = req.body;

            const { requestedWasAccessible } = await resolveReadableWorkspaceIdForUser(userId, workspaceId);
            if (!requestedWasAccessible) {
                return json(res, 403, { error: "Workspace not accessible" });
            }

            const [updatedDoc] = await db.update(knowledgeDocs)
                .set({
                    title,
                    description,
                    content,
                    parentId: parentId || null,
                    updatedAt: new Date()
                })
                .where(and(
                    eq(knowledgeDocs.id, id),
                    eq(knowledgeDocs.workspaceId, workspaceId)
                ))
                .returning();

            return json(res, 200, { doc: updatedDoc });
        }

        if (req.method === "DELETE") {
            const { id, workspaceId } = req.query;

            const { requestedWasAccessible } = await resolveReadableWorkspaceIdForUser(userId, workspaceId as string);
            if (!requestedWasAccessible) {
                return json(res, 403, { error: "Workspace not accessible" });
            }

            await db.delete(knowledgeDocs)
                .where(and(
                    eq(knowledgeDocs.id, id as string),
                    eq(knowledgeDocs.workspaceId, workspaceId as string)
                ));

            return json(res, 200, { success: true });
        }

        return json(res, 405, { error: "Method Not Allowed" });
    } catch (error) {
        console.error("Knowledge API error:", error);
        return json(res, 500, { error: "Internal server error" });
    }
}
