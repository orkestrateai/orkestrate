import { createHash, randomBytes } from "node:crypto";
import { deleteObject, ensureBucket, readTextObject, writeTextObject } from "./supabase";

const OAUTH_BUCKET = "agentalk-oauth";
const CLIENT_PATH = "clients";
const CODE_PATH = "auth-codes";
const ACCESS_PATH = "access-tokens";
const REFRESH_PATH = "refresh-tokens";
const CLIENT_USER_PATH = "client-users";

const AUTH_CODE_TTL_SEC = 300;
const ACCESS_TOKEN_TTL_SEC = 3600;
const REFRESH_TOKEN_TTL_SEC = 60 * 60 * 24 * 30;

function nowEpoch() {
  return Math.floor(Date.now() / 1000);
}

export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

export function pkceS256(value: string | Buffer) {
  return createHash("sha256").update(value).digest("base64url");
}

async function readJson(client: any, path: string) {
  const text = await readTextObject(client, OAUTH_BUCKET, path);
  if (text === null) return null;
  return JSON.parse(text);
}

async function writeJson(client: any, path: string, value: any) {
  await writeTextObject(client, OAUTH_BUCKET, path, JSON.stringify(value), "application/json; charset=utf-8");
}

function clientFile(clientId: string) {
  return `${CLIENT_PATH}/${clientId}.json`;
}

function codeFile(code: string) {
  return `${CODE_PATH}/${code}.json`;
}

function accessFile(accessToken: string) {
  return `${ACCESS_PATH}/${accessToken}.json`;
}

function refreshFile(refreshToken: string) {
  return `${REFRESH_PATH}/${refreshToken}.json`;
}

function clientUserFile(clientId: string) {
  return `${CLIENT_USER_PATH}/${clientId}.json`;
}

export async function createClientRegistration(client: any, registration: any) {
  const clientId = `agentalk_${randomToken(16)}`;
  const created = nowEpoch();
  const record = {
    client_id: clientId,
    client_name: registration.client_name || "Codex",
    redirect_uris: Array.isArray(registration.redirect_uris) ? registration.redirect_uris : [],
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    token_endpoint_auth_method: "none",
    created_at: created,
  };

  await writeJson(client, clientFile(clientId), record);
  return record;
}

export async function getClientRegistration(client: any, clientId: string) {
  if (!clientId) return null;
  return await readJson(client, clientFile(clientId));
}

export async function createAuthorizationCode(client: any, payload: any) {
  const code = randomToken(32);
  const record = {
    code,
    client_id: payload.client_id,
    user_id: payload.user_id, // Store the linked user
    redirect_uri: payload.redirect_uri,
    code_challenge: payload.code_challenge,
    code_challenge_method: payload.code_challenge_method || "S256",
    scope: payload.scope || "",
    created_at: nowEpoch(),
    expires_at: nowEpoch() + AUTH_CODE_TTL_SEC,
  };

  await writeJson(client, codeFile(code), record);
  return record;
}

export async function consumeAuthorizationCode(client: any, code: string) {
  const record = await readJson(client, codeFile(code));
  if (!record) return null;
  await deleteObject(client, OAUTH_BUCKET, codeFile(code));
  return record;
}

export async function issueTokens(client: any, payload: any) {
  const issuedAt = nowEpoch();
  const accessToken = randomToken(40);
  const refreshToken = randomToken(40);

  const accessRecord = {
    access_token: accessToken,
    client_id: payload.client_id,
    user_id: payload.user_id,
    scope: payload.scope || "",
    created_at: issuedAt,
    expires_at: issuedAt + ACCESS_TOKEN_TTL_SEC,
  };

  const refreshRecord = {
    refresh_token: refreshToken,
    client_id: payload.client_id,
    user_id: payload.user_id,
    scope: payload.scope || "",
    created_at: issuedAt,
    expires_at: issuedAt + REFRESH_TOKEN_TTL_SEC,
  };

  await writeJson(client, accessFile(accessToken), accessRecord);
  await writeJson(client, refreshFile(refreshToken), refreshRecord);

  // Best-effort client -> user mapping for telemetry ingestion fallbacks.
  try {
    await writeJson(client, clientUserFile(payload.client_id), {
      client_id: payload.client_id,
      user_id: payload.user_id,
      scope: payload.scope || "",
      updated_at: issuedAt,
    });
  } catch {
    // Do not block token issuance if mapping write fails.
  }

  return {
    token_type: "Bearer",
    access_token: accessToken,
    expires_in: ACCESS_TOKEN_TTL_SEC,
    refresh_token: refreshToken,
    scope: payload.scope || "",
  };
}

export async function getClientUserMapping(client: any, clientId: string) {
  if (!clientId) return null;
  return await readJson(client, clientUserFile(clientId));
}

export async function discoverAndBackfillClientUserMapping(
  client: any,
  clientId: string,
): Promise<string | null> {
  if (!clientId) return null;

  await ensureBucket(client, OAUTH_BUCKET);
  const store = client.storage.from(OAUTH_BUCKET);
  const pageSize = 100;
  const maxPages = 5;
  const now = nowEpoch();

  for (let page = 0; page < maxPages; page += 1) {
    const { data, error } = await store.list(ACCESS_PATH, {
      limit: pageSize,
      offset: page * pageSize,
      sortBy: { column: "created_at", order: "desc" },
    });

    if (error) break;
    if (!Array.isArray(data) || data.length === 0) break;

    for (const entry of data) {
      const name = typeof entry?.name === "string" ? entry.name : "";
      if (!name || !name.endsWith(".json")) continue;

      const record = await readJson(client, `${ACCESS_PATH}/${name}`);
      if (!record || typeof record !== "object") continue;

      const candidateClientId =
        typeof (record as any).client_id === "string" ? (record as any).client_id : "";
      const candidateUserId =
        typeof (record as any).user_id === "string" ? (record as any).user_id : "";
      const expiresAt =
        typeof (record as any).expires_at === "number" ? (record as any).expires_at : null;

      if (candidateClientId !== clientId || !candidateUserId) continue;
      if (expiresAt !== null && expiresAt <= now) continue;

      try {
        await writeJson(client, clientUserFile(clientId), {
          client_id: clientId,
          user_id: candidateUserId,
          scope: typeof (record as any).scope === "string" ? (record as any).scope : "",
          updated_at: now,
        });
      } catch {
        // Ignore backfill write failures; caller still gets the discovered user id.
      }

      return candidateUserId;
    }

    if (data.length < pageSize) break;
  }

  return null;
}

export async function validateAccessToken(client: any, accessToken: string) {
  if (!accessToken) return null;
  const record = await readJson(client, accessFile(accessToken));
  if (!record) return null;

  if (typeof record.expires_at === "number" && record.expires_at <= nowEpoch()) {
    await deleteObject(client, OAUTH_BUCKET, accessFile(accessToken));
    return null;
  }

  return record;
}

export async function rotateRefreshToken(client: any, refreshToken: string, clientIdFromRequest: string) {
  const record = await readJson(client, refreshFile(refreshToken));
  if (!record) return null;

  if (typeof record.expires_at === "number" && record.expires_at <= nowEpoch()) {
    await deleteObject(client, OAUTH_BUCKET, refreshFile(refreshToken));
    return null;
  }

  if (clientIdFromRequest && record.client_id !== clientIdFromRequest) {
    return null;
  }

  await deleteObject(client, OAUTH_BUCKET, refreshFile(refreshToken));
  return await issueTokens(client, {
    client_id: record.client_id,
    user_id: record.user_id,
    scope: record.scope || "",
  });
}
