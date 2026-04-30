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
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { cookies: { getAll() { return []; }, setAll() {} } });
  const { data: { user }, error } = await supabase.auth.getUser(authHeader.slice(7));
  if (error || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.turns) {
    return new Response(JSON.stringify({ error: "turns required" }), { status: 400 });
  }

  const turns: { role: string; content: string }[] = body.turns;
  const existingProfile = body.profile || "";
  const sessionId = body.session_id || "";

  // Build the extraction prompt with conversation context
  const conversationText = turns.map(t => `${t.role}: ${t.content}`).join("\n");

  const instructions = `You are a memory extraction agent for a personal AI companion. Your job is to extract important facts from a conversation and store them.

${existingProfile}

RECENT CONVERSATION:
${conversationText}

INSTRUCTIONS:
1. Extract PERSONAL FACTS the user explicitly stated about themselves (name, location, job, relationships, preferences, interests, projects, context).
2. Extract PREFERENCES (likes, dislikes, style, communication preferences).
3. If the user shared anything that updates their identity or context, update the profile.
4. Store each fact separately with appropriate type and classification.
5. Be conservative — only store EXPLICITLY stated facts, not guesses or inferences.
6. If nothing new was shared, say "No new facts to store." — do NOT fabricate.`;

  const agent = new Experimental_Agent({
    model: bedrock.chat(MODEL_ID.trim()),
    instructions,
    tools: {
      store_memory: {
        description: "Store a fact the user stated.",
        inputSchema: zodSchema(z.object({
          content: z.string(),
          memo_type: z.enum(["fact", "preference", "relationship", "task", "context"]).default("fact"),
          source: z.enum(["explicit", "inferred"]).default("explicit"),
          people: z.array(z.string()).optional(),
          topics: z.array(z.string()).optional(),
        })),
        execute: async (args: any) => {
          const res = await fetch(`${DESKTOP_TOOL_URL}/api/tool/memory-store`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              content: args.content,
              memo_type: args.memo_type || "fact",
              source: args.source || "explicit",
              people: args.people || [],
              topics: args.topics || [],
              session_id: sessionId,
            }),
          });
          return res.ok ? `Stored: ${args.content.slice(0, 80)}` : "Store failed";
        },
      },
      update_profile: {
        description: "Update the user profile with new information.",
        inputSchema: zodSchema(z.object({
          field: z.enum(["name", "add_identity", "add_relationship", "add_preference", "add_professional", "add_context", "add_interest"]),
          value: z.string(),
        })),
        execute: async ({ field, value }: { field: string; value: string }) => {
          const res = await fetch(`${DESKTOP_TOOL_URL}/api/tool/update-profile`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ field, value }),
          });
          return res.ok ? `Profile updated: ${field}` : "Profile update failed";
        },
      },
    },
    stopWhen: stepCountIs(3),
  });

  try {
    const result = await agent.stream({
      messages: [{ role: "user", content: "Extract and store any new facts from this conversation." }],
    });
    return result.toUIMessageStreamResponse({ headers: { "Content-Encoding": "none" } });
  } catch (e: any) {
    console.error("[memory] agent error:", e);
    return new Response(JSON.stringify({ error: "Memory extraction failed", detail: e.message }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }
}
