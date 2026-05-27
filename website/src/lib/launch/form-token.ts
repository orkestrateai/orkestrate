import { createHmac, randomBytes, timingSafeEqual } from "crypto";

const TOKEN_MAX_AGE = 300_000;

function getFormSecret() {
  const secret = process.env.WAITLIST_FORM_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!secret) {
    throw new Error("WAITLIST_FORM_SECRET or SUPABASE_SERVICE_ROLE_KEY is required.");
  }

  return secret;
}

function signToken(token: string) {
  return createHmac("sha256", getFormSecret()).update(token).digest("hex");
}

export function createWaitlistFormToken() {
  const token = `${Date.now()}.${randomBytes(16).toString("hex")}`;
  return { token, signature: signToken(token) };
}

export function verifyWaitlistFormToken(token: unknown, signature: unknown) {
  if (typeof token !== "string" || typeof signature !== "string") return false;

  const match = /^(\d{13})\.([a-f0-9]{32})$/.exec(token);
  if (!match) return false;

  const elapsed = Date.now() - Number(match[1]);
  if (elapsed < 0 || elapsed > TOKEN_MAX_AGE) return false;

  const expected = signToken(token);
  const expectedBuffer = Buffer.from(expected, "hex");
  const actualBuffer = Buffer.from(signature, "hex");

  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}
