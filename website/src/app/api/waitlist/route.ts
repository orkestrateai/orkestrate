export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { joinLaunchWaitlist } from "@/lib/launch/access";
import { verifyWaitlistFormToken } from "@/lib/launch/form-token";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_SOURCES = new Set(["orky_landing_waitlist"]);
const RATE_LIMIT_WINDOW = 60_000;
const RATE_LIMIT_MAX = 3;
const MAX_FORM_BYTES = 4096;

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function pruneRateLimitStore(now: number) {
  if (rateLimitStore.size < 1000) return;

  for (const [ip, entry] of rateLimitStore) {
    if (now > entry.resetAt) {
      rateLimitStore.delete(ip);
    }
  }
}

function getClientIP(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  pruneRateLimitStore(now);

  const entry = rateLimitStore.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

function validateRequestOrigin(req: NextRequest): boolean {
  const expectedOrigin = new URL(req.url).origin;
  const origin = req.headers.get("origin");
  if (origin) return origin === expectedOrigin;

  const referer = req.headers.get("referer");
  if (!referer) return false;
  try {
    return new URL(referer).origin === expectedOrigin;
  } catch {
    return false;
  }
}

async function setFlashCookie(type: "joined" | "bot" | "error") {
  const cookieStore = await cookies();
  cookieStore.set("orky_flash", type, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 5,
    path: "/",
  });
}

function cleanEmail(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase();
}

function cleanSource(value: unknown) {
  if (typeof value !== "string") return "orky_landing_waitlist";
  const source = value.trim().slice(0, 80);
  return ALLOWED_SOURCES.has(source) ? source : "orky_landing_waitlist";
}

export async function POST(req: NextRequest) {
  const ip = getClientIP(req);

  if (!checkRateLimit(ip)) {
    await setFlashCookie("bot");
    return NextResponse.redirect(new URL("/", req.url), 303);
  }

  if (!validateRequestOrigin(req)) {
    await setFlashCookie("bot");
    return NextResponse.redirect(new URL("/", req.url), 303);
  }

  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (contentLength > MAX_FORM_BYTES) {
    await setFlashCookie("bot");
    return NextResponse.redirect(new URL("/", req.url), 303);
  }

  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("application/x-www-form-urlencoded")) {
    return NextResponse.json({ error: "Unsupported media type" }, { status: 415 });
  }

  const formData = await req.formData();
  const email = cleanEmail(formData.get("email"));
  const source = cleanSource(formData.get("source"));
  const websiteField = formData.get("website");
  const website = typeof websiteField === "string" ? websiteField.trim() : "";

  if (!verifyWaitlistFormToken(formData.get("ftoken"), formData.get("fsig"))) {
    await setFlashCookie("bot");
    return NextResponse.redirect(new URL("/", req.url), 303);
  }

  if (website) {
    await setFlashCookie("bot");
    return NextResponse.redirect(new URL("/", req.url), 303);
  }

  if (!EMAIL_RE.test(email) || email.length > 254) {
    await setFlashCookie("error");
    return NextResponse.redirect(new URL("/", req.url), 303);
  }

  try {
    await joinLaunchWaitlist(email, source);
    await setFlashCookie("joined");
    return NextResponse.redirect(new URL("/", req.url), 303);
  } catch (error) {
    console.error("[waitlist] join failed", error);
    await setFlashCookie("error");
    return NextResponse.redirect(new URL("/", req.url), 303);
  }
}
