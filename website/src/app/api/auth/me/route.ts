import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/ssr";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ user: null });
    }

    const githubHandle =
      typeof user.user_metadata?.user_name === "string" ? user.user_metadata.user_name : null;
    const name = typeof user.user_metadata?.name === "string" ? user.user_metadata.name : null;
    const avatarUrl =
      typeof user.user_metadata?.avatar_url === "string" ? user.user_metadata.avatar_url : null;

    const displayName = name ?? (githubHandle ? githubHandle : null) ?? "Publisher";
    const subtitle = githubHandle ? `@${githubHandle}` : user.email;

    return NextResponse.json({
      user: {
        email: user.email ?? null,
        githubHandle,
        name,
        avatarUrl,
        displayName,
        subtitle,
      },
    });
  } catch {
    return NextResponse.json({ user: null });
  }
}