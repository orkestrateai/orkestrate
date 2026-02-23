import type { NextApiRequest, NextApiResponse } from "next";
import { json, readFormBody } from "@/lib/http";
import { createServiceClient } from "@/lib/supabase";
import {
  consumeAuthorizationCode,
  issueTokens,
  pkceS256,
  rotateRefreshToken,
} from "@/lib/oauth-store";

function oauthError(res: NextApiResponse, status: number, error: string, description: string) {
  return json(res, status, {
    error,
    error_description: description,
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "POST") {
      return oauthError(res, 405, "invalid_request", "Method Not Allowed");
    }

    const form = await readFormBody(req);
    const grantType = form.get("grant_type");
    const client = createServiceClient();

    if (grantType === "authorization_code") {
      const code = form.get("code");
      const codeVerifier = form.get("code_verifier");
      const clientId = form.get("client_id");
      const redirectUri = form.get("redirect_uri");

      if (!code || !codeVerifier || !clientId || !redirectUri) {
        return oauthError(res, 400, "invalid_request", "Missing code, code_verifier, client_id, or redirect_uri");
      }

      const codeRecord = await consumeAuthorizationCode(client, code);
      if (!codeRecord) {
        return oauthError(res, 400, "invalid_grant", "Unknown or already used code");
      }

      const now = Math.floor(Date.now() / 1000);
      if (typeof codeRecord.expires_at === "number" && codeRecord.expires_at <= now) {
        return oauthError(res, 400, "invalid_grant", "Authorization code expired");
      }

      if (codeRecord.client_id !== clientId) {
        return oauthError(res, 400, "invalid_grant", "client_id does not match authorization code");
      }

      let isAllowedURI = false;
      if (codeRecord.redirect_uri === redirectUri) {
        isAllowedURI = true;
      } else {
        try {
          const allowed = new URL(codeRecord.redirect_uri);
          const requested = new URL(redirectUri);
          const allowedIsLoopback = allowed.hostname === "127.0.0.1" || allowed.hostname === "::1" || allowed.hostname === "localhost";
          const requestedIsLoopback = requested.hostname === "127.0.0.1" || requested.hostname === "::1" || requested.hostname === "localhost";

          if (allowedIsLoopback && requestedIsLoopback && allowed.pathname === requested.pathname) {
            isAllowedURI = true;
          }
        } catch (e) {
          // Ignore invalid URLs
        }
      }

      if (!isAllowedURI) {
        return oauthError(res, 400, "invalid_grant", "redirect_uri does not match authorization code");
      }

      if ((codeRecord.code_challenge_method || "S256") !== "S256") {
        return oauthError(res, 400, "invalid_grant", "Unsupported code_challenge_method");
      }

      const expectedChallenge = pkceS256(codeVerifier);
      if (expectedChallenge !== codeRecord.code_challenge) {
        return oauthError(res, 400, "invalid_grant", "PKCE verification failed");
      }

      const tokens = await issueTokens(client, {
        client_id: clientId,
        user_id: codeRecord.user_id,
        scope: codeRecord.scope || "",
      });

      return json(res, 200, tokens);
    }

    if (grantType === "refresh_token") {
      const refreshToken = form.get("refresh_token");
      const clientId = form.get("client_id");

      if (!refreshToken) {
        return oauthError(res, 400, "invalid_request", "Missing refresh_token");
      }

      const tokens = await rotateRefreshToken(client, refreshToken, clientId || "");
      if (!tokens) {
        return oauthError(res, 400, "invalid_grant", "Invalid or expired refresh token");
      }

      return json(res, 200, tokens);
    }

    return oauthError(res, 400, "unsupported_grant_type", "Supported grants: authorization_code, refresh_token");
  } catch (error) {
    return oauthError(res, 500, "server_error", error instanceof Error ? error.message : String(error));
  }
}
