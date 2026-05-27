import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database";

type SupabaseAdminClient = ReturnType<typeof createClient<Database>>;

let adminClient: SupabaseAdminClient | null = null;

export function createSupabaseAdminClient() {
  if (adminClient) return adminClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Supabase admin credentials are missing.");
  }

  adminClient = createClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return adminClient;
}
