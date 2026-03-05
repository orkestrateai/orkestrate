import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ ok: true, service: "agentalk-mcp-vercel" }, { headers: { "Cache-Control": "no-store" } });
}
