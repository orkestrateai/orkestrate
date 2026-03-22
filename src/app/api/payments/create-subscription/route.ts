import { NextRequest, NextResponse } from "next/server";
import { authenticateRequestUser } from "@/lib/auth-user-request";
import { createRazorpaySubscription, RAZORPAY_PLANS, RAZORPAY_OFFERS } from "@/lib/razorpay";

function jsonResponse(payload: unknown, status = 200) {
  return NextResponse.json(payload, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  try {
    const user = await authenticateRequestUser(req);
    if (!user?.id) return jsonResponse({ error: "Unauthorized" }, 401);

    const payload = await req.json().catch(() => ({}));
    const planType = typeof payload.planType === "string" ? payload.planType.toUpperCase() : "PRO";

    const planId = planType === "TEAM" ? RAZORPAY_PLANS.TEAM : RAZORPAY_PLANS.PRO;
    const offerId = planType === "TEAM" ? RAZORPAY_OFFERS.TEAM : RAZORPAY_OFFERS.PRO;
    
    if (!planId || planId.includes("default")) {
       // In development without real plan IDs, we return a mock success or error
       if (process.env.NODE_ENV === "development") {
         console.log("Mocking subscription creation for plan:", planType);
         return jsonResponse({
           subscriptionId: "sub_mock_" + Math.random().toString(36).slice(2, 10),
           planId: "plan_mock_" + planType,
         });
       }
       return jsonResponse({ error: "Razorpay Plans are not configured." }, 500);
    }

    const subscription = await createRazorpaySubscription({
      planId,
      offerId,
      customerNotify: true,
    });

    return jsonResponse({
      subscriptionId: subscription.id,
      planId: subscription.plan_id,
    });
  } catch (error) {
    console.error("Failed to create subscription:", error);
    return jsonResponse({ 
      error: "Internal server error", 
      detail: error instanceof Error ? error.message : String(error) 
    }, 500);
  }
}
