import express from "express";
import cors from "cors";
import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";

const app = express();
app.use(cors());
app.use(express.json());

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Chat endpoint — streams AI SDK response
app.post("/api/chat", async (req, res) => {
  try {
    const { messages } = req.body;

    const result = streamText({
      model: openai("gpt-4o-mini"),
      system:
        "You are Orkestrate, a helpful personal AI companion with long-term memory. You remember details about the user across conversations and use that memory to provide personalized, context-aware responses.",
      messages,
    });

    result.pipeDataStreamToResponse(res);
  } catch (error) {
    console.error("Chat error:", error);
    res.status(500).json({ error: "Failed to generate response" });
  }
});

// Memory endpoints — placeholders for Phase 3
app.post("/api/memory/search", async (_req, res) => {
  res.json({ results: [] });
});

app.post("/api/memory/store", async (_req, res) => {
  res.json({ success: true });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Memory server running on http://localhost:${PORT}`);
});
