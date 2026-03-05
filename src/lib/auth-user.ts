import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import type { NextApiRequest } from "next";
import { bearerToken } from "@/lib/http";

export type AuthenticatedApiUser = {
  id: string;
  email: string | null;
};

let authClient: SupabaseClient | null = null;

function getAuthClient() {
  if (authClient) return authClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Missing Supabase public credentials. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }

  authClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return authClient;
}

function toAuthenticatedApiUser(user: User): AuthenticatedApiUser {
  return {
    id: user.id,
    email: user.email ?? null,
  };
}

function tryDecodeJson(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function tryBase64Decode(value: string) {
  try {
    return Buffer.from(value, "base64").toString("utf8");
  } catch {
    return null;
  }
}

function extractAccessTokenFromCookieValue(raw: string) {
  const decoded = decodeURIComponent(raw || "");
  if (!decoded) return null;

  const candidates: string[] = [decoded];

  if (decoded.startsWith("base64-")) {
    const b64 = tryBase64Decode(decoded.slice("base64-".length));
    if (b64) candidates.push(b64);
  } else {
    const b64 = tryBase64Decode(decoded);
    if (b64) candidates.push(b64);
  }

  for (const candidate of candidates) {
    const parsed = tryDecodeJson(candidate);
    if (!parsed) continue;

    if (typeof parsed === "string" && parsed.trim()) {
      return parsed.trim();
    }

    if (Array.isArray(parsed)) {
      const [first] = parsed;
      if (typeof first === "string" && first.trim()) return first.trim();
      if (first && typeof first === "object" && typeof (first as Record<string, unknown>).access_token === "string") {
        return String((first as Record<string, unknown>).access_token);
      }
    }

    if (typeof parsed === "object" && parsed !== null) {
      const obj = parsed as Record<string, unknown>;
      if (typeof obj.access_token === "string" && obj.access_token.trim()) {
        return obj.access_token.trim();
      }
    }
  }

  return null;
}

function accessTokenFromSupabaseCookies(req: NextApiRequest) {
  const entries = Object.entries(req.cookies || {});
  const grouped = new Map<string, Array<{ index: number; value: string }>>();

  for (const [name, value] of entries) {
    const match = name.match(/^(.*-auth-token)(?:\.(\d+))?$/);
    if (!match) continue;

    const base = match[1];
    const index = Number(match[2] ?? 0);
    const list = grouped.get(base) ?? [];
    list.push({ index, value: String(value || "") });
    grouped.set(base, list);
  }

  for (const chunks of grouped.values()) {
    const raw = chunks
      .sort((a, b) => a.index - b.index)
      .map((chunk) => chunk.value)
      .join("");

    const token = extractAccessTokenFromCookieValue(raw);
    if (token) return token;
  }

  return null;
}

export async function authenticateBearerToken(token: string | null | undefined): Promise<AuthenticatedApiUser | null> {
  if (!token) return null;

  const client = getAuthClient();
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user?.id) return null;

  return toAuthenticatedApiUser(data.user);
}

export async function authenticateApiRequest(req: NextApiRequest): Promise<AuthenticatedApiUser | null> {
  const token = bearerToken(req) || accessTokenFromSupabaseCookies(req);
  return authenticateBearerToken(token);
}
