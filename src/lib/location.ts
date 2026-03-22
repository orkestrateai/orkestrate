import { NextRequest } from "next/server";

/**
 * Detects the user's country code from Vercel headers.
 * Fallback to 'US' for local dev or if detection fails.
 */
export function getCountryCode(req: NextRequest): string {
  const vercelCountry = req.headers.get("x-vercel-ip-country");
  if (vercelCountry) return vercelCountry.toUpperCase();
  
  // For development or non-Vercel environments
  return "IN"; // Default to IN for development if you want to see Rupees
}

export const IS_INDIA = (country: string) => country === "IN";
