import { db } from "@/db";
import { subscriptions, workspaces, members } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";

export type PlanType = "hobby" | "pro" | "team" | "enterprise";

export const PLAN_LIMITS: Record<
  PlanType,
  { maxAgents: number; maxMembers: number; maxWorkspaces: number }
> = {
  hobby: { maxAgents: 3, maxMembers: 1, maxWorkspaces: 2 },
  pro: { maxAgents: 10, maxMembers: 2, maxWorkspaces: 10 },
  team: { maxAgents: 999, maxMembers: 5, maxWorkspaces: 999 },
  enterprise: { maxAgents: 9999, maxMembers: 9999, maxWorkspaces: 9999 },
};

/**
 * Returns the effective plan limits for a user based on their active subscription.
 * Falls back to hobby limits if no subscription exists.
 */
export async function getEffectiveLimitsForUser(userId: string) {
  const sub = await getUserSubscription(userId);
  const plan = (sub?.planType as PlanType | undefined) ?? "hobby";
  return PLAN_LIMITS[plan] ?? PLAN_LIMITS.hobby;
}

/**
 * Updates a user's subscription and synchronizes their workspace limits.
 */
export async function updateUserSubscription(args: {
  userId: string;
  planType: PlanType;
  razorpaySubscriptionId?: string;
  status: string;
  currentPeriodEnd?: Date;
}) {
  const now = new Date();
  const limits = PLAN_LIMITS[args.planType];

  await db.transaction(async (tx) => {
    // 1. Update or Insert Subscription
    const existing = await tx.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, args.userId),
    });

    if (existing) {
      await tx
        .update(subscriptions)
        .set({
          planType: args.planType,
          razorpaySubscriptionId:
            args.razorpaySubscriptionId ?? existing.razorpaySubscriptionId,
          status: args.status,
          currentPeriodEnd: args.currentPeriodEnd ?? existing.currentPeriodEnd,
          updatedAt: now,
        })
        .where(eq(subscriptions.id, existing.id));
    } else {
      await tx.insert(subscriptions).values({
        id: `sub_${randomUUID().replace(/-/g, "").slice(0, 12)}`,
        userId: args.userId,
        planType: args.planType,
        razorpaySubscriptionId: args.razorpaySubscriptionId,
        status: args.status,
        currentPeriodEnd: args.currentPeriodEnd,
        updatedAt: now,
      });
    }

    // 2. Sync workspace limits for all workspaces owned by the user
    // In a multi-workspace world, we usually apply limits to the owner.
    await tx
      .update(workspaces)
      .set({
        maxAgents: limits.maxAgents,
        maxMembers: limits.maxMembers,
        updatedAt: now,
      })
      .where(eq(workspaces.ownerUserId, args.userId));
  });
}

/**
 * Retrieves the current subscription for a user.
 */
export async function getUserSubscription(userId: string) {
  return db.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, userId),
  });
}

/**
 * Retrieves a subscription by Razorpay subscription ID.
 */
export async function getSubscriptionByRazorpayId(
  razorpaySubscriptionId: string,
) {
  return db.query.subscriptions.findFirst({
    where: eq(subscriptions.razorpaySubscriptionId, razorpaySubscriptionId),
  });
}
