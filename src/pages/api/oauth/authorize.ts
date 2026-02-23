import type { NextApiRequest, NextApiResponse } from "next";
import { createServiceClient } from "@/lib/supabase";
import { createAuthorizationCode, getClientRegistration } from "@/lib/oauth-store";

function sendOAuthError(res: NextApiResponse, status: number, error: string, description: string) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.send(JSON.stringify({ error, error_description: description }));
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "GET") {
      return sendOAuthError(res, 405, "invalid_request", "Method Not Allowed");
    }

    const base = `https://${req.headers.host}`;
    const url = new URL(req.url || "/oauth/authorize", base);
    const params = url.searchParams;

    const responseType = params.get("response_type");
    const clientId = params.get("client_id");
    const redirectUri = params.get("redirect_uri");
    const state = params.get("state");
    const codeChallenge = params.get("code_challenge");
    const codeChallengeMethod = params.get("code_challenge_method") || "S256";
    const scope = params.get("scope") || "";
    const approve = params.get("approve") === "1";

    if (responseType !== "code") {
      return sendOAuthError(res, 400, "unsupported_response_type", "response_type must be 'code'");
    }

    if (!clientId || !redirectUri || !codeChallenge) {
      return sendOAuthError(res, 400, "invalid_request", "Missing client_id, redirect_uri, or code_challenge");
    }

    if (codeChallengeMethod !== "S256") {
      return sendOAuthError(res, 400, "invalid_request", "code_challenge_method must be S256");
    }

    const client = createServiceClient();
    const registration = await getClientRegistration(client, clientId);
    if (!registration) {
      return sendOAuthError(res, 400, "unauthorized_client", "Unknown client_id");
    }

    let isAllowedURI = false;
    if (Array.isArray(registration.redirect_uris)) {
      for (const allowedUri of registration.redirect_uris) {
        if (allowedUri === redirectUri) {
          isAllowedURI = true;
          break;
        }

        // Loopback IP port variation allowance (RFC 8252)
        try {
          const allowed = new URL(allowedUri);
          const requested = new URL(redirectUri);
          const allowedIsLoopback = allowed.hostname === "127.0.0.1" || allowed.hostname === "::1" || allowed.hostname === "localhost";
          const requestedIsLoopback = requested.hostname === "127.0.0.1" || requested.hostname === "::1" || requested.hostname === "localhost";

          // If both are loopbacks, we only need the pathname to match. Port can vary.
          if (allowedIsLoopback && requestedIsLoopback && allowed.pathname === requested.pathname) {
            isAllowedURI = true;
            break;
          }
        } catch (e) {
          // Ignore invalid URLs
        }
      }
    }

    if (!isAllowedURI) {
      return sendOAuthError(res, 400, "invalid_request", `redirect_uri is not allowed for this client. Requested: ${redirectUri}, Allowed: ${Array.isArray(registration.redirect_uris) ? registration.redirect_uris.join(", ") : 'none'}`);
    }

    const userId = params.get("user_id");

    if (!approve) {
      // Hand off to the Next.js App Router Server Component UI
      const frontendUrl = new URL("/oauth/authorize", base);
      frontendUrl.search = params.toString(); // Pass along all the OAuth parameters

      res.status(302).setHeader("Cache-Control", "no-store");
      res.setHeader("Location", frontendUrl.toString());
      return res.end();
    }

    if (!userId) {
      return sendOAuthError(res, 400, "invalid_request", "Missing user_id on approval");
    }

    const code = await createAuthorizationCode(client, {
      client_id: clientId,
      user_id: userId,
      redirect_uri: redirectUri,
      code_challenge: codeChallenge,
      code_challenge_method: codeChallengeMethod,
      scope,
    });

    const redirect = new URL(redirectUri);
    redirect.searchParams.set("code", code.code);
    if (state) redirect.searchParams.set("state", state);

    res.status(302).setHeader("Cache-Control", "no-store");
    res.setHeader("Location", redirect.toString());
    res.end();
  } catch (error) {
    return sendOAuthError(res, 500, "server_error", error instanceof Error ? error.message : String(error));
  }
}
