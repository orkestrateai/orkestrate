import {
  discoverAndBackfillClientUserMapping,
  getClientRegistration,
  getClientUserMapping,
} from "@/lib/oauth-store";
import { createServiceClient } from "@/lib/supabase";

const CACHE_TTL_MS = 5 * 60 * 1000;

type CacheEntry = {
  value: string | null;
  expiresAt: number;
};

const clientNameCache = new Map<string, CacheEntry>();
const clientUserIdCache = new Map<string, CacheEntry>();

export async function getClientNameHint(clientId: unknown): Promise<string | null> {
  const key = typeof clientId === "string" ? clientId.trim() : "";
  if (!key) return null;

  const now = Date.now();
  const cached = clientNameCache.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  let value: string | null = null;
  try {
    const serviceClient = createServiceClient();
    const registration = await getClientRegistration(serviceClient, key);
    value =
      registration && typeof registration.client_name === "string"
        ? registration.client_name
        : null;
  } catch {
    value = null;
  }

  clientNameCache.set(key, { value, expiresAt: now + CACHE_TTL_MS });
  return value;
}

export async function getClientUserIdHint(clientId: unknown): Promise<string | null> {
  const key = typeof clientId === "string" ? clientId.trim() : "";
  if (!key) return null;

  const now = Date.now();
  const cached = clientUserIdCache.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  let value: string | null = null;
  try {
    const serviceClient = createServiceClient();
    const mapping = await getClientUserMapping(serviceClient, key);
    value =
      mapping && typeof mapping.user_id === "string" && mapping.user_id
        ? mapping.user_id
        : null;

    if (!value) {
      value = await discoverAndBackfillClientUserMapping(serviceClient, key);
    }
  } catch {
    value = null;
  }

  clientUserIdCache.set(key, { value, expiresAt: now + CACHE_TTL_MS });
  return value;
}
