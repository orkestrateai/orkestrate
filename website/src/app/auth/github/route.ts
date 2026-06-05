import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/ssr";

export async function GET() {
  const requestHeaders = await headers();
  const origin = requestHeaders.get("origin") ?? "https://orkestrate.space";
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "github",
    options: {
      redirectTo: `${origin}/auth/callback?next=/submit`,
    },
  });

  if (error || !data.url) {
    return NextResponse.redirect(new URL("/submit?auth=error", origin));
  }

  return NextResponse.redirect(data.url);
}
