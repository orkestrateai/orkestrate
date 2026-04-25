import express from "express";
import cors from "cors";
import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";
import { ChatMemoryService } from "./memory/chat-memory.js";

const app = express();
app.use(cors());
app.use(express.json());

const hasApiKey = !!process.env.OPENAI_API_KEY;
const openai = hasApiKey
  ? createOpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

// Initialize chat memory
const memory = new ChatMemoryService("./data/memories");
await memory.initialize();

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", memoryEnabled: true, llmEnabled: hasApiKey });
});

// Helper: create a simple text stream for mock mode
function createTextStream(text: string): ReadableStream {
  return new ReadableStream({
    start(controller) {
      // AI SDK data stream protocol: 0:"text"
      const encoder = new TextEncoder();
      const chunks = text.match(/.{1,20}/g) ?? [text];
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(`0:${JSON.stringify(chunk)}\n`));
      }
      // Finish marker
      controller.enqueue(encoder.encode(`f:{"finishReason":"stop","usage":{"promptTokens":0,"completionTokens":0}}\n`));
      controller.close();
    },
  });
}

// Chat endpoint — streams AI SDK response with memory
app.post("/api/chat", async (req, res) => {
  try {
    const { messages, sessionId = "default" } = req.body;
    const lastUserMessage = messages[messages.length - 1];

    // 1. Store user message
    if (lastUserMessage?.role === "user") {
      await memory.storeTurn(sessionId, "user", lastUserMessage.content);
    }

    // 2. Search for relevant memories from the user's query
    const userQuery = lastUserMessage?.content ?? "";
    const relevantMemories = await memory.findRelevantMemories(userQuery, 5);

    // 3. Build memory context block (capped to avoid token overflow)
    let memoryContext = "";
    if (relevantMemories.length > 0) {
      const memLines = relevantMemories.map((m) => {
        const role = m.metadata?.role === "user" ? "User" : "Assistant";
        const date = new Date(m.createdAt).toLocaleDateString();
        const content = m.content.length > 200 ? m.content.slice(0, 200) + "..." : m.content;
        return `- [${date}] ${role}: ${content}`;
      });
      memoryContext = "\n\n## Relevant Past Memories\n" + memLines.join("\n");
    }

    // 4. Build system prompt with memory context
    const systemPrompt =
      "You are Orkestrate, a helpful personal AI companion with long-term memory. " +
      "You remember details about the user across conversations and use that memory to provide personalized, context-aware responses." +
      memoryContext;

    // 5. Generate response
    if (hasApiKey && openai) {
      const result = streamText({
        model: openai("gpt-4o-mini"),
        system: systemPrompt,
        messages,
      });

      // Pipe stream to response
      result.pipeDataStreamToResponse(res);

      // Store assistant response after stream completes
      result.text.then(async (text) => {
        if (text?.trim()) {
          await memory.storeTurn(sessionId, "assistant", text);
        }
      }).catch((err) => {
        console.error("Failed to store assistant memory:", err);
      });
    } else {
      // Mock mode: generate a simple response and stream it
      const mockResponse = generateMockResponse(lastUserMessage?.content ?? "", relevantMemories);
      const stream = createTextStream(mockResponse);

      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("x-vercel-ai-data-stream", "v1");
      const reader = stream.getReader();
      const pump = async () => {
        const { done, value } = await reader.read();
        if (done) {
          res.end();
          await memory.storeTurn(sessionId, "assistant", mockResponse);
          return;
        }
        res.write(value);
        pump();
      };
      pump();
    }
  } catch (error) {
    console.error("Chat error:", error);
    res.status(500).json({ error: "Failed to generate response" });
  }
});

function generateMockResponse(userMessage: string, memories: any[]): string {
  if (memories.length > 0) {
    const memPreview = memories[0].content.slice(0, 80);
    return `[Mock mode — no API key] I remember you mentioned something about "${memPreview}". You said: "${userMessage}"`;
  }
  return `[Mock mode — no API key] You said: "${userMessage}". (Add OPENAI_API_KEY to .env for real responses)`;
}

// Memory API endpoints
app.post("/api/memory/search", async (req, res) => {
  try {
    const { query, limit = 5 } = req.body;
    const results = await memory.findRelevantMemories(query, limit);
    res.json({ results });
  } catch (error) {
    console.error("Memory search error:", error);
    res.status(500).json({ error: "Search failed" });
  }
});

app.get("/api/memory/recent", async (req, res) => {
  try {
    const sessionId = req.query.sessionId as string | undefined;
    const limit = parseInt(req.query.limit as string) || 10;
    const results = await memory.getRecentMemories(sessionId, limit);
    res.json({ results });
  } catch (error) {
    console.error("Memory recent error:", error);
    res.status(500).json({ error: "Failed to fetch recent memories" });
  }
});

app.get("/api/memory/stats", async (_req, res) => {
  try {
    const stats = await memory.getStats();
    res.json(stats);
  } catch (error) {
    console.error("Memory stats error:", error);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Memory server running on http://localhost:${PORT}`);
  console.log(`Memory storage: ./data/memories`);
  console.log(`LLM mode: ${hasApiKey ? "OpenAI" : "MOCK (set OPENAI_API_KEY for real responses)"}`);
});
