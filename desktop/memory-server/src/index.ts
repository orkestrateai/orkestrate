import "dotenv/config";
import express from "express";
import cors from "cors";
import { opencode } from "ai-sdk-provider-opencode-sdk";
import { streamText } from "ai";
import { ChatMemoryService } from "./memory/chat-memory.js";

const app = express();
app.use(cors());
app.use(express.json());

// Initialize chat memory
const memory = new ChatMemoryService("./data/memories");
await memory.initialize();

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", memoryEnabled: true, llmProvider: "opencode" });
});

// Helper: encode text as AI SDK data stream chunks
function createDataStream(text: string): ReadableStream {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      // Send text in chunks of ~20 chars to simulate streaming
      const chunks = text.match(/.{1,20}/g) ?? [text];
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(`0:${JSON.stringify(chunk)}\n`));
      }
      // Send finish marker
      controller.enqueue(
        encoder.encode(`e:{"finishReason":"stop","usage":{"promptTokens":0,"completionTokens":0}}\n`),
      );
      controller.close();
    },
  });
}

// Chat endpoint — generates AI response with memory
app.post("/api/chat", async (req, res) => {
  try {
    const { messages, sessionId = "default" } = req.body;
    const lastUserMessage = messages[messages.length - 1];

    console.log("[chat] Request received, session:", sessionId, "messages:", messages.length);

    // 1. Store user message
    if (lastUserMessage?.role === "user") {
      await memory.storeTurn(sessionId, "user", lastUserMessage.content);
      console.log("[chat] Stored user message:", lastUserMessage.content.slice(0, 60));
    }

    // 2. Search for relevant memories from the user's query
    const userQuery = lastUserMessage?.content ?? "";
    const relevantMemories = await memory.findRelevantMemories(userQuery, 5);
    console.log("[chat] Found", relevantMemories.length, "relevant memories");

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

    // 5. Generate response using OpenCode provider
    console.log("[chat] Calling streamText...");
    const result = streamText({
      model: opencode("opencode/minimax-m2.5-free") as any,
      system: systemPrompt,
      messages,
    });

    // Consume the text (this works with OpenCode provider)
    const text = await result.text;
    console.log("[chat] Assistant text received, length:", text?.length ?? 0);

    // Store assistant response
    if (text?.trim()) {
      await memory.storeTurn(sessionId, "assistant", text);
      console.log("[chat] Stored assistant response");
    }

    // Stream the response back to client using AI SDK data stream format
    const stream = createDataStream(text ?? "");
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("x-vercel-ai-data-stream", "v1");

    const reader = stream.getReader();
    const pump = async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            res.end();
            break;
          }
          res.write(value);
        }
      } catch (streamErr) {
        console.error("[chat] Stream error:", streamErr);
        res.end();
      }
    };
    pump();
  } catch (error) {
    console.error("[chat] Error:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to generate response", details: String(error) });
    }
  }
});

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
const server = app.listen(PORT, () => {
  console.log(`Memory server running on http://localhost:${PORT}`);
  console.log(`Memory storage: ./data/memories`);
  console.log(`LLM provider: OpenCode (model: opencode/minimax-m2.5-free)`);
  console.log(`Press Ctrl+C to stop the server`);
});

// Graceful shutdown: close server and dispose OpenCode provider
async function shutdown(signal: string) {
  console.log(`\n[${signal}] Shutting down...`);

  // Close HTTP server
  server.close(() => {
    console.log("HTTP server closed");
  });

  // Force close after 3 seconds
  setTimeout(() => {
    console.log("Forcing exit...");
    process.exit(0);
  }, 3000);

  // Dispose OpenCode provider
  try {
    await opencode.dispose();
    console.log("OpenCode provider disposed");
  } catch (err) {
    console.error("Error disposing OpenCode:", err);
  }

  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

// Windows: handle Ctrl+C when stdin is available
if (process.stdin.isTTY) {
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.on("data", (key: Buffer) => {
    // Ctrl+C = \x03
    if (key.toString() === "\u0003") {
      shutdown("Ctrl+C");
    }
  });
}
