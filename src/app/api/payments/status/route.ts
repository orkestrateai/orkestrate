import { NextRequest, NextResponse } from "next/server";
import { authenticateRequestUser } from "@/lib/auth-user-request";
import { getUserSubscription, PLAN_LIMITS } from "@/lib/payments-core";

function jsonResponse(payload: unknown, status = 200) {
  return NextResponse.json(payload, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(req: NextRequest) {
  try {
    const user = await authenticateRequestUser(req);
    if (!user?.id) return jsonResponse({ error: "Unauthorized" }, 401);

    const subscription = await getUserSubscription(user.id);
    const planType = subscription?.planType || "hobby";

    return jsonResponse({
      planType,
      status: subscription?.status || "active",
      currentPeriodEnd: subscription?.currentPeriodEnd,
      limits: PLAN_LIMITS[planType as keyof typeof PLAN_LIMITS] || PLAN_LIMITS.hobby,
    });
  } catch (error) {
    console.error("Failed to fetch subscription status:", error);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
}
