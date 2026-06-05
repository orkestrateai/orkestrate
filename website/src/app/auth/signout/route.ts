import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/ssr";

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();

  return NextResponse.redirect(new URL("/", request.url), { status: 303 });
}
