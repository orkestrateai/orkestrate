import { NextRequest, NextResponse } from "next/server";

function noStoreJson(payload: unknown, status = 200) {
  return NextResponse.json(payload, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(req: NextRequest) {
  let base = req.nextUrl.origin;
  if (base.includes("www.orkestrate.space")) {
    base = base.replace("www.orkestrate.space", "orkestrate.space");
  }
  return noStoreJson({
    resource: `${base}/api/mcp`,
    authorization_servers: [base],
    bearer_methods_supported: ["header"],
    resource_documentation: `${base}/`,
  });
}
