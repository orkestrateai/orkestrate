export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { generateText } from "ai";
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
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { cookies: { getAll() { return []; }, setAll() {} } });
  const { data: { user }, error } = await supabase.auth.getUser(authHeader.slice(7));
  if (error || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.action) {
    return new Response(JSON.stringify({ error: "action required" }), { status: 400 });
  }

  try {
    let result: string;

    switch (body.action) {
      case "title": {
        if (!body.message) return new Response(JSON.stringify({ error: "message required" }), { status: 400 });
        const r = await generateText({
          model: bedrock.chat(MODEL_ID.trim()),
          prompt: `Generate a 3-5 word title for this conversation. Only output the title, nothing else. No quotes, no punctuation at the end.\n\nMessage: "${body.message}"`,
          maxOutputTokens: 20,
          temperature: 0.3,
        });
        result = r.text.trim();
        break;
      }

      case "summarize": {
        if (!body.turns || !Array.isArray(body.turns)) {
          return new Response(JSON.stringify({ error: "turns array required" }), { status: 400 });
        }
        const conversation = body.turns.map((t: any) => `${t.role}: ${t.content}`).join("\n");
        const r = await generateText({
          model: bedrock.chat(MODEL_ID.trim()),
          prompt: `Summarize this conversation in 2-3 sentences. Include key topics and any decisions or facts shared.\n\n${conversation}`,
          maxOutputTokens: 200,
          temperature: 0.5,
        });
        result = r.text.trim();
        break;
      }

      default:
        return new Response(JSON.stringify({ error: "unknown action" }), { status: 400 });
    }

    return new Response(JSON.stringify({ result }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[utility] error:", e);
    return new Response(JSON.stringify({ error: "Utility call failed", detail: e.message }), {
      status: 502,
    });
  }
}
