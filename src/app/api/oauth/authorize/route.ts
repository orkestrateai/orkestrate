import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { createAuthorizationCode, getClientRegistration } from "@/lib/oauth-store";

function oauthError(status: number, error: string, description: string) {
  return NextResponse.json({ error, error_description: description }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams;

    const responseType = params.get("response_type");
    const clientId = params.get("client_id");
    const redirectUri = params.get("redirect_uri");
    const state = params.get("state");
    const codeChallenge = params.get("code_challenge");
    const codeChallengeMethod = params.get("code_challenge_method") || "S256";
    const scope = params.get("scope") || "";
    const approve = params.get("approve") === "1";

    if (responseType !== "code") return oauthError(400, "unsupported_response_type", "response_type must be 'code'");
    if (!clientId || !redirectUri || !codeChallenge) return oauthError(400, "invalid_request", "Missing client_id, redirect_uri, or code_challenge");
    if (codeChallengeMethod !== "S256") return oauthError(400, "invalid_request", "code_challenge_method must be S256");

    const client = createServiceClient();
    const registration = await getClientRegistration(client, clientId);
    if (!registration) return oauthError(400, "unauthorized_client", "Unknown client_id");

    let isAllowedURI = false;
    if (Array.isArray(registration.redirect_uris)) {
      for (const allowedUri of registration.redirect_uris) {
        if (allowedUri === redirectUri) {
          isAllowedURI = true;
          break;
        }
        try {
          const allowed = new URL(allowedUri);
          const requested = new URL(redirectUri);
          const allowedIsLoopback = allowed.hostname === "127.0.0.1" || allowed.hostname === "::1" || allowed.hostname === "localhost";
          const requestedIsLoopback = requested.hostname === "127.0.0.1" || requested.hostname === "::1" || requested.hostname === "localhost";
          if (allowedIsLoopback && requestedIsLoopback && allowed.pathname === requested.pathname) {
            isAllowedURI = true;
            break;
          }
        } catch {
          // ignore
        }
      }
    }

    if (!isAllowedURI) {
      return oauthError(400, "invalid_request", `redirect_uri is not allowed for this client. Requested: ${redirectUri}, Allowed: ${Array.isArray(registration.redirect_uris) ? registration.redirect_uris.join(", ") : "none"}`);
    }

    const userId = params.get("user_id");

    if (!approve) {
      const frontendUrl = new URL("/oauth/authorize", req.nextUrl.origin);
      frontendUrl.search = params.toString();
      return NextResponse.redirect(frontendUrl, { headers: { "Cache-Control": "no-store" } });
    }

    if (!userId) return oauthError(400, "invalid_request", "Missing user_id on approval");

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

    return NextResponse.redirect(redirect, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return oauthError(500, "server_error", error instanceof Error ? error.message : String(error));
  }
}
