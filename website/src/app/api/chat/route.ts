export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { streamText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";

const MODEL_ID = process.env.BEDROCK_MODEL_ID || "minimax.minimax-m2.5";
const region = process.env.AWS_REGION || "us-east-1";

const bedrock = createOpenAI({
  apiKey: process.env.AWS_BEARER_TOKEN_BEDROCK,
  baseURL: `https://bedrock-mantle.${region}.api.aws/v1`,
});

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
  }
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { cookies: { getAll() { return []; }, setAll() {} } });
  const { data: { user }, error } = await supabase.auth.getUser(authHeader.slice(7));
  if (error || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
  }
  const body = await req.json().catch(() => null);
  if (!body?.messages) {
    return new Response(JSON.stringify({ error: "messages required" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }
  const system = (body.system || "") + `\n\nUser identity: ${user.email || user.id}`;
  const result = streamText({ model: bedrock.chat(MODEL_ID.trim()), system, messages: body.messages });
  return result.toUIMessageStreamResponse({ headers: { "Content-Encoding": "none" } });
}
