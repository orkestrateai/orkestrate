import type { NextApiRequest, NextApiResponse } from "next";
import { json, readJsonBody } from "@/lib/http";
import { createServiceClient } from "@/lib/supabase";
import { createClientRegistration } from "@/lib/oauth-store";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "POST") {
      return json(res, 405, { error: "Method Not Allowed" });
    }

    const body = await readJsonBody(req);
    if (!Array.isArray(body.redirect_uris) || body.redirect_uris.length === 0) {
      return json(res, 400, {
        error: "invalid_client_metadata",
        error_description: "redirect_uris is required",
      });
    }

    const client = createServiceClient();
    const registration = await createClientRegistration(client, body);

    return json(res, 201, {
      client_id: registration.client_id,
      client_id_issued_at: registration.created_at,
      client_name: registration.client_name,
      redirect_uris: registration.redirect_uris,
      grant_types: registration.grant_types,
      response_types: registration.response_types,
      token_endpoint_auth_method: registration.token_endpoint_auth_method,
    });
  } catch (error) {
    return json(res, 500, {
      error: "server_error",
      error_description: error instanceof Error ? error.message : String(error),
    });
  }
}
