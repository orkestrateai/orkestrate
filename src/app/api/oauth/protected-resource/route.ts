import { NextRequest, NextResponse } from "next/server";

function noStoreJson(payload: unknown, status = 200) {
  return NextResponse.json(payload, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(req: NextRequest) {
  const base = req.nextUrl.origin;
  return noStoreJson({
    resource: `${base}/api/mcp`,
    authorization_servers: [base],
    bearer_methods_supported: ["header"],
    resource_documentation: `${base}/`,
  });
}
