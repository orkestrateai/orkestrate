export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { Experimental_Agent, stepCountIs, zodSchema } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";

const MODEL_ID = process.env.BEDROCK_MODEL_ID || "minimax.minimax-m2.5";
const region = process.env.AWS_REGION || "us-east-1";

const bedrock = createOpenAI({
  apiKey: process.env.AWS_BEARER_TOKEN_BEDROCK,
  baseURL: `https://bedrock-mantle.${region}.api.aws/v1`,
});

const DESKTOP_TOOL_URL = "http://127.0.0.1:3001";

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

  const instructions = (body.system || "") + `\n\nUser identity: ${user.email || user.id}`;

  // Lightweight chat agent — only search_memory tool (1 tool, not 4).
  // Desktop pre-fetches profile + episodes + session context into the system prompt,
  // so store_memory, update_profile are handled by the background /api/memory agent.
  const agent = new Experimental_Agent({
    model: bedrock.chat(MODEL_ID.trim()),
    instructions,
    tools: {
      search_memory: {
        description: "SEARCH personal memory for facts, preferences, or past conversations. Only call this when you specifically need to look up stored information that isn't already in the context.",
        inputSchema: zodSchema(z.object({
          queries: z.array(z.string()).describe("1-3 search queries. Include names, topics, keywords."),
        })),
        execute: async ({ queries }: { queries: string[] }) => {
          try {
            const res = await fetch(`${DESKTOP_TOOL_URL}/api/tool/memory-search`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ queries }),
            });
            if (!res.ok) return "Memory search failed.";
            const data = await res.json();
            if (!Array.isArray(data) || data.length === 0) {
              return "No matching memories found.";
            }
            return data.map((r: any) => `[${r.type}] ${r.content}`).join("\n");
          } catch {
            return "Memory search unavailable.";
          }
        },
      },
    },
    stopWhen: stepCountIs(3),
  });

  try {
    const result = await agent.stream({ messages: body.messages });
    return result.toUIMessageStreamResponse({ headers: { "Content-Encoding": "none" } });
  } catch (e: any) {
    console.error("[chat] agent error:", e);
    return new Response(JSON.stringify({ error: "Agent inference failed", detail: e.message }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }
}
