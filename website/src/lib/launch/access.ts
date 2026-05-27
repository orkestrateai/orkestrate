import { createSupabaseAdminClient } from "@/lib/supabase/server";

export async function joinLaunchWaitlist(email: string, source = "orky_landing_waitlist") {
  const supabase = createSupabaseAdminClient();
  const normalized = email.trim().toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) || normalized.length > 254) {
    throw new Error("Enter a valid email address.");
  }

  const { error } = await supabase.from("waitlist").upsert(
    {
      email: normalized,
      source,
      status: "joined",
    },
    { onConflict: "email" },
  );

  if (error) throw new Error(error.message);

  return { ok: true };
}
