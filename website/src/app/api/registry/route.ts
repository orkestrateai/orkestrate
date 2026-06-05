import { NextResponse } from "next/server";
import { listRegistryApiItems } from "@/lib/registry/catalog";

export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Accept, Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET() {
  try {
    const payload = await listRegistryApiItems();
    return NextResponse.json(payload, { headers: CORS_HEADERS });
  } catch (error) {
    console.error("[api/registry] Unhandled error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}