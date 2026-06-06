import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/ssr";

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();

  const referer = request.headers.get("referer");
  const fallback = new URL("/submit", request.url);
  let redirectTo = fallback;

  if (referer) {
    try {
      const ref = new URL(referer);
      const origin = new URL(request.url).origin;
      if (ref.origin === origin) redirectTo = ref;
    } catch {
      // keep fallback
    }
  }

  return NextResponse.redirect(redirectTo, { status: 303 });
}
