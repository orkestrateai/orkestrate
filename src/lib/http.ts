import type { NextApiRequest, NextApiResponse } from "next";

export function json(res: NextApiResponse, status: number, payload: any, extraHeaders: Record<string, string> = {}) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  Object.entries(extraHeaders).forEach(([key, value]) => res.setHeader(key, value));
  res.send(JSON.stringify(payload));
}

export function baseUrl(req: NextApiRequest) {
  const proto = String(req.headers["x-forwarded-proto"] || "https").split(",")[0].trim();
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0].trim();
  return `${proto}://${host}`;
}

export function bearerToken(req: NextApiRequest) {
  const auth = req.headers.authorization;
  if (typeof auth !== "string" || !auth.startsWith("Bearer ")) return null;
  const token = auth.slice("Bearer ".length).trim();
  return token || null;
}

export function sendOAuthChallenge(res: NextApiResponse, req: NextApiRequest, description = "Valid OAuth bearer token required.") {
  const base = baseUrl(req);
  const resourceMeta = `${base}/.well-known/oauth-protected-resource/api/mcp`;
  const challenge = `Bearer realm="agentalk", error="invalid_token", error_description="${description}", resource_metadata="${resourceMeta}"`;
  return json(res, 401, { error: "unauthorized", error_description: description }, {
    "WWW-Authenticate": challenge,
  });
}

async function readRawBody(req: NextApiRequest) {
  if (typeof req.body === "string") return req.body;
  if (Buffer.isBuffer(req.body)) return req.body.toString("utf8");
  if (req.body && typeof req.body === "object") {
    return JSON.stringify(req.body);
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req as any) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

export async function readJsonBody(req: NextApiRequest) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
    return req.body;
  }
  const raw = await readRawBody(req);
  return raw ? JSON.parse(raw) : {};
}

export async function readFormBody(req: NextApiRequest) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
    return new URLSearchParams(Object.entries(req.body));
  }
  const raw = await readRawBody(req);
  return new URLSearchParams(raw);
}
