import { NextRequest, NextResponse } from "next/server";
import { authenticateRequestUser } from "@/lib/auth-user-request";
import { getOnboardingStatus } from "@/lib/onboarding-core";

function noStoreJson(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(req: NextRequest) {
  try {
    const user = await authenticateRequestUser(req);
    if (!user?.id) return noStoreJson({ error: "Unauthorized" }, 401);

    const status = await getOnboardingStatus(user.id);
    return noStoreJson(status);
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
