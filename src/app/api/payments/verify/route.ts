import { NextRequest, NextResponse } from "next/server";
import { authenticateRequestUser } from "@/lib/auth-user-request";
import { updateUserSubscription } from "@/lib/payments-core";
import crypto from "node:crypto";

function jsonResponse(payload: unknown, status = 200) {
  return NextResponse.json(payload, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  try {
    const user = await authenticateRequestUser(req);
    if (!user?.id) return jsonResponse({ error: "Unauthorized" }, 401);

    const { 
      razorpay_payment_id, 
      razorpay_subscription_id, 
      razorpay_signature,
      planType 
    } = await req.json().catch(() => ({}));

    if (!razorpay_payment_id || !razorpay_subscription_id || !razorpay_signature) {
      return jsonResponse({ error: "Missing verification details" }, 400);
    }

    // Verify signature
    const secret = process.env.RAZORPAY_KEY_SECRET || "";
    const generated_signature = crypto
      .createHmac("sha256", secret)
      .update(razorpay_payment_id + "|" + razorpay_subscription_id)
      .digest("hex");

    if (generated_signature !== razorpay_signature) {
       // In mock mode we might want to bypass?
       if (process.env.NODE_ENV !== "development") {
         return jsonResponse({ error: "Invalid signature" }, 400);
       }
       console.log("Mocking signature verification success in development");
    }

    // Update database
    await updateUserSubscription({
      userId: user.id,
      planType: (planType || "pro").toLowerCase() as any,
      razorpaySubscriptionId: razorpay_subscription_id,
      status: "active",
      currentPeriodEnd: new Date(Date.now() + 31 * 24 * 60 * 60 * 1000), // Default 1 month extension
    });

    return jsonResponse({ success: true });
  } catch (error) {
    console.error("Verification failed:", error);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
}
