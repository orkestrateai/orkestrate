import { NextRequest, NextResponse } from "next/server";
import { getCountryCode } from "@/lib/location";

export async function GET(req: NextRequest) {
  const country = getCountryCode(req);
  return NextResponse.json({ country });
}
