import { NextRequest, NextResponse } from "next/server";
import { authenticateRequestUser } from "@/lib/auth-user-request";
import { canAccessWorkspace, ensureActiveWorkspaceForUser } from "@/lib/workspaces-core";

function noStoreJson(payload: unknown, status = 200) {
  return NextResponse.json(payload, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(req: NextRequest) {
  try {
    const user = await authenticateRequestUser(req);
    if (!user?.id) return noStoreJson({ error: "Unauthorized" }, 401);

    const workspaceIdParam = req.nextUrl.searchParams.get("workspaceId") || "";
    const workspaceId = workspaceIdParam || await ensureActiveWorkspaceForUser(user.id);

    if (!workspaceId) {
      return noStoreJson({ error: "No workspace available" }, 404);
    }

    const allowed = await canAccessWorkspace(user.id, workspaceId);
    if (!allowed) return noStoreJson({ error: "Workspace not accessible" }, 403);

    return noStoreJson({ logs: [] });
  } catch (error) {
    return noStoreJson({ error: "Internal server error", detail: error instanceof Error ? error.message : String(error) }, 500);
  }
}
