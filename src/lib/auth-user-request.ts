import type { NextRequest } from "next/server";
import { authenticateBearerToken, type AuthenticatedApiUser } from "@/lib/auth-user";

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
    if (typeof parsed === "string" && parsed.trim()) return parsed.trim();
    if (Array.isArray(parsed)) {
      const [first] = parsed;
      if (typeof first === "string" && first.trim()) return first.trim();
      if (first && typeof first === "object" && typeof (first as Record<string, unknown>).access_token === "string") {
        return String((first as Record<string, unknown>).access_token);
      }
    }
    if (typeof parsed === "object" && parsed !== null) {
      const obj = parsed as Record<string, unknown>;
      if (typeof obj.access_token === "string" && obj.access_token.trim()) return obj.access_token.trim();
    }
  }

  return null;
}

function accessTokenFromSupabaseCookies(req: NextRequest) {
  const grouped = new Map<string, Array<{ index: number; value: string }>>();
  for (const cookie of req.cookies.getAll()) {
    const match = cookie.name.match(/^(.*-auth-token)(?:\.(\d+))?$/);
    if (!match) continue;
    const base = match[1];
    const index = Number(match[2] ?? 0);
    const list = grouped.get(base) ?? [];
    list.push({ index, value: String(cookie.value || "") });
    grouped.set(base, list);
  }

  for (const chunks of grouped.values()) {
    const raw = chunks.sort((a, b) => a.index - b.index).map((c) => c.value).join("");
    const token = extractAccessTokenFromCookieValue(raw);
    if (token) return token;
  }

  return null;
}

function bearerTokenFromRequest(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!auth || !auth.startsWith("Bearer ")) return null;
  const token = auth.slice("Bearer ".length).trim();
  return token || null;
}

export async function authenticateRequestUser(req: NextRequest): Promise<AuthenticatedApiUser | null> {
  const token = bearerTokenFromRequest(req) || accessTokenFromSupabaseCookies(req);
  return authenticateBearerToken(token);
}
