import { getIntentDefinition, isIntentId, listIntentIds } from "@/lib/intent-workflows/catalog";
import type { IntentId, IntentResolution } from "@/lib/intent-workflows/types";

function normalizedText(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function scoreFrom(label: "high" | "medium" | "low") {
  if (label === "high") return 0.95;
  if (label === "medium") return 0.75;
  return 0.55;
}

export function normalizeIntentChain(raw: unknown): IntentId[] {
  if (!Array.isArray(raw)) return [];
  const chain: IntentId[] = [];
  for (const value of raw) {
    if (isIntentId(value)) chain.push(value);
  }
  return chain;
}

export function resolveIntent(userPrompt: string, forceIntent?: unknown): IntentResolution {
  if (isIntentId(forceIntent)) {
    const def = getIntentDefinition(forceIntent);
    return {
      intentId: forceIntent,
      confidence: scoreFrom("high"),
      confidenceLabel: "high",
      editable: def.editable,
      why: `forceIntent override selected '${forceIntent}'.`,
    };
  }

  const text = normalizedText(userPrompt || "");

  if (!text) {
    const def = getIntentDefinition("implement");
    return {
      intentId: "implement",
      confidence: scoreFrom("low"),
      confidenceLabel: "low",
      editable: def.editable,
      why: "Empty prompt defaults to implement intent.",
    };
  }

  const rules: Array<{ intentId: IntentId; label: "high" | "medium"; pattern: RegExp; why: string }> = [
    {
      intentId: "handoff",
      label: "high",
      pattern: /\b(handoff|hand off|hand over|transfer|take over)\b/,
      why: "Prompt indicates transfer of ownership.",
    },
    {
      intentId: "review",
      label: "high",
      pattern: /\b(review|audit|inspect|verify|qa check|check this)\b/,
      why: "Prompt requests validation/review activity.",
    },
    {
      intentId: "observe",
      label: "high",
      pattern: /\b(what is everyone doing|what's everyone doing|status|who is working|who's working|team status|progress)\b/,
      why: "Prompt asks for awareness/status, not implementation.",
    },
    {
      intentId: "delegate",
      label: "medium",
      pattern: /\b(delegate|assign|ask .* to|tell .* to|have .* do)\b/,
      why: "Prompt indicates assigning work to someone else.",
    },
    {
      intentId: "assist",
      label: "high",
      pattern: /\b(help|assist|support|pair with|unblock)\b/,
      why: "Prompt indicates helping an existing workstream.",
    },
    {
      intentId: "implement",
      label: "high",
      pattern: /\b(implement|build|add|create|fix|refactor|clean up|cleanup|ship)\b/,
      why: "Prompt requests direct implementation work.",
    },
  ];

  for (const rule of rules) {
    if (!rule.pattern.test(text)) continue;
    const def = getIntentDefinition(rule.intentId);
    return {
      intentId: rule.intentId,
      confidence: scoreFrom(rule.label),
      confidenceLabel: rule.label,
      editable: def.editable,
      why: rule.why,
    };
  }

  const fallback = "implement";
  const fallbackDef = getIntentDefinition(fallback);
  return {
    intentId: fallback,
    confidence: scoreFrom("low"),
    confidenceLabel: "low",
    editable: fallbackDef.editable,
    why: `No rule matched. Falling back to '${fallback}' from available intents: ${listIntentIds().join(", ")}.`,
  };
}
