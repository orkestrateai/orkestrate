import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database";

type SupabaseAdminClient = ReturnType<typeof createClient<Database>>;

let adminClient: SupabaseAdminClient | null = null;

function adminCredentials() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;
  return { url, serviceRoleKey };
}

export function tryCreateSupabaseAdminClient() {
  if (adminClient) return adminClient;

  const creds = adminCredentials();
  if (!creds) return null;

  adminClient = createClient<Database>(creds.url, creds.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return adminClient;
}

export function createSupabaseAdminClient() {
  const client = tryCreateSupabaseAdminClient();
  if (!client) {
    throw new Error("Supabase admin credentials are missing.");
  }
  return client;
}
