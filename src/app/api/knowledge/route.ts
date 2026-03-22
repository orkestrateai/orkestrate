import { NextRequest, NextResponse } from "next/server";
import { authenticateRequestUser } from "@/lib/auth-user-request";
import { db } from "@/db";
import { knowledgeDocs } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { nanoid } from "nanoid";

function noStoreJson(payload: unknown, status = 200) {
  return NextResponse.json(payload, { status, headers: { "Cache-Control": "no-store" } });
}

// GET - List all docs for a workspace
export async function GET(req: NextRequest) {
  try {
    const user = await authenticateRequestUser(req);
    if (!user?.id) return noStoreJson({ error: "Unauthorized" }, 401);

    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get("workspaceId");

    if (!workspaceId) return noStoreJson({ error: "Missing workspaceId" }, 400);

    const docs = await db
      .select()
      .from(knowledgeDocs)
      .where(eq(knowledgeDocs.workspaceId, workspaceId))
      .orderBy(desc(knowledgeDocs.updatedAt));

    return noStoreJson({ docs });
  } catch (error) {
    return noStoreJson({ error: "Internal server error", detail: error instanceof Error ? error.message : String(error) }, 500);
  }
}

// POST - Create new doc or folder
export async function POST(req: NextRequest) {
  try {
    const user = await authenticateRequestUser(req);
    if (!user?.id) return noStoreJson({ error: "Unauthorized" }, 401);

    const payload = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const workspaceId = typeof payload.workspaceId === "string" ? payload.workspaceId : "";
    const title = typeof payload.title === "string" ? payload.title : "";
    const description = typeof payload.description === "string" ? payload.description : "";
    const content = typeof payload.content === "string" ? payload.content : "";
    const parentId = typeof payload.parentId === "string" ? payload.parentId : null;
    const isFolder = typeof payload.isFolder === "boolean" ? payload.isFolder : false;

    if (!workspaceId) return noStoreJson({ error: "Missing workspaceId" }, 400);
    if (!title.trim()) return noStoreJson({ error: "Missing title" }, 400);

    const id = nanoid();
    const now = new Date();

    const [doc] = await db
      .insert(knowledgeDocs)
      .values({
        id,
        workspaceId,
        title: title.trim(),
        description: description.trim(),
        content,
        parentId,
        isFolder,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return noStoreJson({ doc }, 201);
  } catch (error) {
    return noStoreJson({ error: "Internal server error", detail: error instanceof Error ? error.message : String(error) }, 500);
  }
}

// PUT - Update existing doc
export async function PUT(req: NextRequest) {
  try {
    const user = await authenticateRequestUser(req);
    if (!user?.id) return noStoreJson({ error: "Unauthorized" }, 401);

    const payload = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const id = typeof payload.id === "string" ? payload.id : "";
    const workspaceId = typeof payload.workspaceId === "string" ? payload.workspaceId : "";
    const title = typeof payload.title === "string" ? payload.title : undefined;
    const description = typeof payload.description === "string" ? payload.description : undefined;
    const content = typeof payload.content === "string" ? payload.content : undefined;
    const parentId = typeof payload.parentId === "string" ? payload.parentId : (payload.parentId === null ? null : undefined);

    if (!id) return noStoreJson({ error: "Missing id" }, 400);
    if (!workspaceId) return noStoreJson({ error: "Missing workspaceId" }, 400);

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (title !== undefined) updates.title = title.trim();
    if (description !== undefined) updates.description = description.trim();
    if (content !== undefined) updates.content = content;
    if (parentId !== undefined) updates.parentId = parentId;

    const [doc] = await db
      .update(knowledgeDocs)
      .set(updates)
      .where(and(eq(knowledgeDocs.id, id), eq(knowledgeDocs.workspaceId, workspaceId)))
      .returning();

    if (!doc) return noStoreJson({ error: "Document not found" }, 404);

    return noStoreJson({ doc });
  } catch (error) {
    return noStoreJson({ error: "Internal server error", detail: error instanceof Error ? error.message : String(error) }, 500);
  }
}

// DELETE - Delete doc or folder (cascade delete children)
export async function DELETE(req: NextRequest) {
  try {
    const user = await authenticateRequestUser(req);
    if (!user?.id) return noStoreJson({ error: "Unauthorized" }, 401);

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const workspaceId = searchParams.get("workspaceId");

    if (!id) return noStoreJson({ error: "Missing id" }, 400);
    if (!workspaceId) return noStoreJson({ error: "Missing workspaceId" }, 400);

    // Check if doc exists and belongs to workspace
    const [doc] = await db
      .select()
      .from(knowledgeDocs)
      .where(and(eq(knowledgeDocs.id, id), eq(knowledgeDocs.workspaceId, workspaceId)))
      .limit(1);

    if (!doc) return noStoreJson({ error: "Document not found" }, 404);

    // If it's a folder, recursively delete all children
    if (doc.isFolder) {
      await deleteDocAndChildren(id, workspaceId);
    } else {
      await db
        .delete(knowledgeDocs)
        .where(and(eq(knowledgeDocs.id, id), eq(knowledgeDocs.workspaceId, workspaceId)));
    }

    return noStoreJson({ success: true, id });
  } catch (error) {
    return noStoreJson({ error: "Internal server error", detail: error instanceof Error ? error.message : String(error) }, 500);
  }
}

// Helper function to recursively delete a folder and all its children
async function deleteDocAndChildren(docId: string, workspaceId: string) {
  // Find all children
  const children = await db
    .select()
    .from(knowledgeDocs)
    .where(and(eq(knowledgeDocs.parentId, docId), eq(knowledgeDocs.workspaceId, workspaceId)));

  // Recursively delete children
  for (const child of children) {
    if (child.isFolder) {
      await deleteDocAndChildren(child.id, workspaceId);
    } else {
      await db
        .delete(knowledgeDocs)
        .where(and(eq(knowledgeDocs.id, child.id), eq(knowledgeDocs.workspaceId, workspaceId)));
    }
  }

  // Delete the folder itself
  await db
    .delete(knowledgeDocs)
    .where(and(eq(knowledgeDocs.id, docId), eq(knowledgeDocs.workspaceId, workspaceId)));
}
