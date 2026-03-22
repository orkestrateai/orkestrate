import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/razorpay";
import { getSubscriptionByRazorpayId, updateUserSubscription } from "@/lib/payments-core";

function jsonResponse(payload: unknown, status = 200) {
  return NextResponse.json(payload, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const signature = req.headers.get("x-razorpay-signature") || "";
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || "";

    if (!verifyWebhookSignature(body, signature, webhookSecret)) {
       if (process.env.NODE_ENV !== "development") {
          return jsonResponse({ error: "Invalid signature" }, 400);
       }
       console.log("Mocking webhook signature verification success in development");
    }

    const event = JSON.parse(body);
    const { event: eventName, payload } = event;

    console.log(`Processing Razorpay webhook: ${eventName}`);

    if (eventName.startsWith("subscription.")) {
      const razorpaySubscription = payload.subscription.entity;
      const subId = razorpaySubscription.id;
      const existing = await getSubscriptionByRazorpayId(subId);

      if (existing) {
        let status = "active";
        if (eventName === "subscription.cancelled" || eventName === "subscription.expired") {
          status = "cancelled";
        } else if (eventName === "subscription.halted") {
          status = "past_due";
        }

        await updateUserSubscription({
          userId: existing.userId,
          planType: existing.planType as any,
          razorpaySubscriptionId: subId,
          status,
          currentPeriodEnd: razorpaySubscription.current_end ? new Date(razorpaySubscription.current_end * 1000) : undefined,
        });
      }
    }

    return jsonResponse({ received: true });
  } catch (error) {
    console.error("Webhook processing failed:", error);
    // Always return 200 to Razorpay to prevent retries of poison messages, unless it's a real retryable error
    return jsonResponse({ received: false, error: "Internal processing error" }, 200);
  }
}
