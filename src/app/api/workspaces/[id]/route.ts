import { NextRequest, NextResponse } from "next/server";
import { authenticateRequestUser } from "@/lib/auth-user-request";
import { listWorkspacesForUser } from "@/lib/workspaces-core";

function noStoreJson(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await authenticateRequestUser(req);
    if (!user?.id) return noStoreJson({ error: "Unauthorized" }, 401);

    const { id } = await params;
    const workspaces = await listWorkspacesForUser(user.id);
    const workspace = workspaces.find((ws) => ws.id === id);

    if (!workspace) {
      return noStoreJson({ error: "Workspace not found" }, 404);
    }

    return noStoreJson({ workspace });
  } catch (error) {
    return noStoreJson(
      {
        error: "Internal server error",
        detail: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
}
