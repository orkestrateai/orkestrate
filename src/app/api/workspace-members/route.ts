import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { authenticateRequestUser } from "@/lib/auth-user-request";
import { canAccessWorkspace, ensureActiveWorkspaceForUser } from "@/lib/workspaces-core";
import { db } from "@/db";
import { members } from "@/db/schema";
import { createClient } from "@supabase/supabase-js";

function noStoreJson(payload: unknown, status = 200) {
    return NextResponse.json(payload, { status, headers: { "Cache-Control": "no-store" } });
}

function getAdminClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) return null;
    return createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function GET(req: NextRequest) {
    try {
        const user = await authenticateRequestUser(req);
        if (!user?.id) return noStoreJson({ error: "Unauthorized" }, 401);

        const workspaceIdParam = req.nextUrl.searchParams.get("workspaceId") || "";
        const workspaceId = workspaceIdParam || await ensureActiveWorkspaceForUser(user.id);
        if (!workspaceId) return noStoreJson({ error: "No active workspace" }, 400);

        const allowed = await canAccessWorkspace(user.id, workspaceId);
        if (!allowed) return noStoreJson({ error: "Workspace not accessible" }, 403);

        const workspaceMembers = await db.select().from(members).where(eq(members.workspaceId, workspaceId));

        // Try to get user details from Supabase admin API
        const admin = getAdminClient();
        const userDetails = new Map<string, { name: string; email: string; avatar: string }>();

        if (admin) {
            const userIds = workspaceMembers.map((m) => m.userId);
            for (const uid of userIds) {
                try {
                    const { data } = await admin.auth.admin.getUserById(uid);
                    if (data?.user) {
                        userDetails.set(uid, {
                            name: data.user.user_metadata?.full_name || data.user.email?.split("@")[0] || "User",
                            email: data.user.email || "",
                            avatar: data.user.user_metadata?.avatar_url || "",
                        });
                    }
                } catch {
                    // Ignore individual user fetch failures
                }
            }
        }

        const mappedMembers = workspaceMembers.map((m) => {
            const details = userDetails.get(m.userId);
            return {
                id: m.id,
                userId: m.userId,
                role: m.role,
                isCurrentUser: m.userId === user.id,
                displayName: details?.name || (m.userId === user.id ? (user.email?.split("@")[0] || "You") : "Member"),
                email: details?.email || (m.userId === user.id ? (user.email || "") : ""),
                avatarUrl: details?.avatar || "",
                joinedAt: m.createdAt.toISOString(),
            };
        });

        return noStoreJson({ workspaceId, members: mappedMembers });
    } catch (error) {
        return noStoreJson({ error: "Internal server error", detail: error instanceof Error ? error.message : String(error) }, 500);
    }
}
