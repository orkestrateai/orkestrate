import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { createClientRegistration } from "@/lib/oauth-store";

function noStoreJson(payload: unknown, status = 200) {
  return NextResponse.json(payload, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as any));
    if (!Array.isArray(body.redirect_uris) || body.redirect_uris.length === 0) {
      return noStoreJson({ error: "invalid_client_metadata", error_description: "redirect_uris is required" }, 400);
    }

    const client = createServiceClient();
    const registration = await createClientRegistration(client, body);

    return noStoreJson({
      client_id: registration.client_id,
      client_id_issued_at: registration.created_at,
      client_name: registration.client_name,
      redirect_uris: registration.redirect_uris,
      grant_types: registration.grant_types,
      response_types: registration.response_types,
      token_endpoint_auth_method: registration.token_endpoint_auth_method,
    }, 201);
  } catch (error) {
    return noStoreJson({ error: "server_error", error_description: error instanceof Error ? error.message : String(error) }, 500);
  }
}
