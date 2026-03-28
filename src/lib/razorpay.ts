import Razorpay from "razorpay";

const keyId = process.env.RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;

if (!keyId || !keySecret) {
  console.warn("RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET is missing from environment variables.");
}

export const razorpay = (keyId && keySecret) 
  ? new Razorpay({ key_id: keyId, key_secret: keySecret })
  : {} as any;

export const RAZORPAY_PLANS = {
  PRO: process.env.RAZORPAY_PLAN_PRO_ID || "plan_pro_default",
  TEAM: process.env.RAZORPAY_PLAN_TEAM_ID || "plan_team_default",
};

export const RAZORPAY_OFFERS = {
  PRO: process.env.RAZORPAY_OFFER_PRO_ID || null,
  TEAM: process.env.RAZORPAY_OFFER_TEAM_ID || null,
};

/**
 * Verifies the Razorpay webhook signature.
 */
export function verifyWebhookSignature(body: string, signature: string, secret: string) {
  return Razorpay.validateWebhookSignature(body, signature, secret);
}

/**
 * Creates a subscription in Razorpay.
 */
export async function createRazorpaySubscription(args: {
  planId: string;
  offerId?: string | null;
  totalCount?: number;
  customerNotify?: boolean;
}) {
  return razorpay.subscriptions.create({
    plan_id: args.planId,
    offer_id: args.offerId || undefined,
    total_count: args.totalCount ?? 120, // 10 years by default for monthly
    customer_notify: args.customerNotify ? 1 : 0,
    addons: [],
    notes: {
      source: "orkestrate_web",
    },
  });
}
