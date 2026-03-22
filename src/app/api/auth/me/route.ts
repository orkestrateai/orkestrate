import { NextRequest, NextResponse } from "next/server";
import { authenticateRequestUser } from "@/lib/auth-user-request";
import { createServiceClient } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  try {
    const user = await authenticateRequestUser(req);
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let email = user.email;

    // If email is missing (e.g. from custom OAuth store mapping), try to fetch it from Supabase Auth admin
    if (!email) {
      try {
        const client = createServiceClient();
        const { data } = await client.auth.admin.getUserById(user.id);
        if (data?.user?.email) {
          email = data.user.email;
        }
      } catch (err) {
        console.error("[api/auth/me] Failed to fetch user email by ID:", err);
      }
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: email || "unknown@orkestrate.space",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error", detail: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
