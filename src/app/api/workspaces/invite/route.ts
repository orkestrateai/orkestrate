import { NextRequest, NextResponse } from "next/server";
import { randomBytes, createHash } from "node:crypto";
import { and, eq, gt, or, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { members, workspaces, workspaceInvites } from "@/db/schema";
import { authenticateRequestUser } from "@/lib/auth-user-request";
import { nanoid } from "nanoid";

function noStoreJson(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function generateInviteCode(): string {
  return randomBytes(24).toString("base64url");
}

// POST - create/accept/revoke invites
export async function POST(req: NextRequest) {
  try {
    const user = await authenticateRequestUser(req);
    if (!user?.id) return noStoreJson({ error: "Unauthorized" }, 401);

    const body = (await req.json()) as {
      action?: string;
      workspaceId?: string;
      code?: string;
      role?: string;
      maxUses?: number | null;
      expiresAt?: string | null;
    };

    if (body.action === "create") {
      if (!body.workspaceId) {
        return noStoreJson({ error: "workspaceId is required" }, 400);
      }

      const membership = await db.query.members.findFirst({
        where: and(eq(members.userId, user.id), eq(members.workspaceId, body.workspaceId)),
      });
      if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
        return noStoreJson({ error: "Only owners and admins can create invites" }, 403);
      }

      const inviteId = "inv_" + nanoid(16);
      const code = generateInviteCode();
      const now = new Date();

      await db.insert(workspaceInvites).values({
        id: inviteId,
        workspaceId: body.workspaceId,
        code,
        role: body.role === "admin" ? "admin" : "member",
        maxUses: body.maxUses ?? null,
        usedCount: 0,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
        createdByUserId: user.id,
        createdAt: now,
      });

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://orkestrate.space";
      return noStoreJson({
        invite: {
          id: inviteId, code,
          url: baseUrl + "/invite/" + code,
          workspaceId: body.workspaceId,
          role: body.role === "admin" ? "admin" : "member",
          maxUses: body.maxUses ?? null, usedCount: 0, expiresAt: body.expiresAt ?? null,
        },
      });
    }

    if (body.action === "accept") {
      if (!body.code) return noStoreJson({ error: "code is required" }, 400);
      const now = new Date();
      const invite = await db.query.workspaceInvites.findFirst({ where: eq(workspaceInvites.code, body.code) });
      if (!invite) return noStoreJson({ error: "Invalid invite code" }, 404);
      if (invite.expiresAt && invite.expiresAt <= now) return noStoreJson({ error: "Invite has expired" }, 410);
      if (invite.maxUses !== null && invite.usedCount >= invite.maxUses) return noStoreJson({ error: "Invite has been fully used" }, 410);

      const existing = await db.query.members.findFirst({
        where: and(eq(members.userId, user.id), eq(members.workspaceId, invite.workspaceId)),
      });
      if (existing) return noStoreJson({ success: true, message: "Already a member", workspaceId: invite.workspaceId });

      await db.transaction(async (tx) => {
        await tx.insert(members).values({
          id: "mem_" + nanoid(12),
          workspaceId: invite.workspaceId, userId: user.id, role: invite.role,
          isActive: false, createdAt: now, updatedAt: now,
        });
        await tx.update(workspaceInvites).set({ usedCount: invite.usedCount + 1 }).where(eq(workspaceInvites.id, invite.id));
      });

      return noStoreJson({ success: true, workspaceId: invite.workspaceId, role: invite.role });
    }

    if (body.action === "revoke") {
      if (!body.code) return noStoreJson({ error: "code is required" }, 400);
      const invite = await db.query.workspaceInvites.findFirst({ where: eq(workspaceInvites.code, body.code) });
      if (!invite) return noStoreJson({ error: "Invite not found" }, 404);

      const membership = await db.query.members.findFirst({
        where: and(eq(members.userId, user.id), eq(members.workspaceId, invite.workspaceId)),
      });
      if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
        return noStoreJson({ error: "Only owners and admins can revoke invites" }, 403);
      }

      await db.update(workspaceInvites).set({ expiresAt: new Date() }).where(eq(workspaceInvites.id, invite.id));
      return noStoreJson({ success: true });
    }

    return noStoreJson({ error: "Invalid action" }, 400);
  } catch (error) {
    return noStoreJson({ error: "Internal server error", detail: error instanceof Error ? error.message : String(error) }, 500);
  }
}

// GET - lookup invite by code or list invites for workspace
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const workspaceId = url.searchParams.get("workspaceId");

    if (code) {
      const invite = await db.query.workspaceInvites.findFirst({ where: eq(workspaceInvites.code, code) });
      if (!invite) return noStoreJson({ error: "Invalid invite code" }, 404);
      const now = new Date();
      if (invite.expiresAt && invite.expiresAt <= now) return noStoreJson({ error: "Invite has expired" }, 410);
      if (invite.maxUses !== null && invite.usedCount >= invite.maxUses) return noStoreJson({ error: "Invite has been fully used" }, 410);

      const ws = await db.query.workspaces.findFirst({ where: eq(workspaces.id, invite.workspaceId), columns: { name: true, repoUrl: true } });
      return noStoreJson({
        code: invite.code, workspaceId: invite.workspaceId, workspaceName: ws?.name ?? "Unknown",
        repoUrl: ws?.repoUrl, role: invite.role,
        remainingUses: invite.maxUses !== null ? invite.maxUses - invite.usedCount : null,
        expiresAt: invite.expiresAt?.toISOString() ?? null,
      });
    }

    if (workspaceId) {
      const user = await authenticateRequestUser(req);
      if (!user?.id) return noStoreJson({ error: "Unauthorized" }, 401);
      const membership = await db.query.members.findFirst({
        where: and(eq(members.userId, user.id), eq(members.workspaceId, workspaceId)),
      });
      if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
        return noStoreJson({ error: "Only owners and admins can list invites" }, 403);
      }
      const now = new Date();
      const invites = await db.query.workspaceInvites.findMany({ where: eq(workspaceInvites.workspaceId, workspaceId) });
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://orkestrate.space";
      return noStoreJson({
        invites: invites.map((inv) => ({
          id: inv.id, code: inv.code, url: baseUrl + "/invite/" + inv.code,
          role: inv.role, maxUses: inv.maxUses, usedCount: inv.usedCount,
          expiresAt: inv.expiresAt?.toISOString() ?? null, expired: inv.expiresAt ? inv.expiresAt <= now : false,
        })),
      });
    }

    return noStoreJson({ error: "code or workspaceId query param required" }, 400);
  } catch (error) {
    return noStoreJson({ error: "Internal server error", detail: error instanceof Error ? error.message : String(error) }, 500);
  }
}
