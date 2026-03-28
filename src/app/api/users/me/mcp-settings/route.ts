import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { authenticateRequestUser } from "@/lib/auth-user-request";
import { db } from "@/db";
import { userMcpSettings, type McpSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { TOOL_CATEGORIES, type ToolCategory } from "@/lib/mcp-categories";

// Default settings structure
const DEFAULT_SETTINGS: McpSettings = {
  workspace: { enabled: true, disabledTools: [] },
  messaging: { enabled: true, disabledTools: [] },
  knowledge: { enabled: true, disabledTools: [] },
};

function jsonResponse(payload: unknown, status = 200) {
  return NextResponse.json(payload, { status, headers: { "Cache-Control": "no-store" } });
}

// JSON-RPC helpers
function rpcResult(id: string | number | null, result: unknown) {
  return { jsonrpc: "2.0", id, result };
}

function rpcError(id: string | number | null, code: number, message: string) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

// Validate tool names against TOOL_CATEGORIES
function validateToolNames(tools: string[]): { valid: boolean; invalid?: string[] } {
  const allValidTools: string[] = Object.values(TOOL_CATEGORIES).flat();
  const invalid = tools.filter((t) => !allValidTools.includes(t));
  return invalid.length === 0 ? { valid: true } : { valid: false, invalid };
}

// Parse and validate incoming settings
function parseAndValidateSettings(body: unknown): { ok: true; settings: McpSettings } | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Invalid request body" };
  }

  const raw = body as Record<string, unknown>;
  const settings: McpSettings = { ...DEFAULT_SETTINGS };

  for (const [category, value] of Object.entries(raw)) {
    if (category !== "workspace" && category !== "messaging" && category !== "knowledge") {
      return { ok: false, error: `Invalid category: ${category}` };
    }

    if (typeof value !== "object" || value === null) {
      return { ok: false, error: `Invalid value for category: ${category}` };
    }

    const catValue = value as { enabled?: boolean; disabledTools?: string[] };

    if (typeof catValue.enabled === "boolean") {
      settings[category as ToolCategory] = { ...settings[category as ToolCategory]!, enabled: catValue.enabled };
    }

    if (Array.isArray(catValue.disabledTools)) {
      const validation = validateToolNames(catValue.disabledTools);
      if (!validation.valid) {
        return { ok: false, error: `Invalid tool names in ${category}: ${validation.invalid!.join(", ")}` };
      }
      settings[category as ToolCategory] = { ...settings[category as ToolCategory]!, disabledTools: catValue.disabledTools };
    }
  }

  return { ok: true, settings };
}

export async function GET(req: NextRequest) {
  try {
    const user = await authenticateRequestUser(req);
    if (!user?.id) {
      return jsonResponse(rpcError(null, -32001, "Unauthorized"), 401);
    }

    const existing = await db
      .select()
      .from(userMcpSettings)
      .where(eq(userMcpSettings.userId, user.id))
      .limit(1);

    if (existing.length > 0 && existing[0].settings) {
      const stored = existing[0].settings as McpSettings;
      const merged: McpSettings = {
        workspace: { ...DEFAULT_SETTINGS.workspace!, ...stored.workspace },
        messaging: { ...DEFAULT_SETTINGS.messaging!, ...stored.messaging },
        knowledge: { ...DEFAULT_SETTINGS.knowledge!, ...stored.knowledge },
      };
      return jsonResponse(rpcResult(null, { settings: merged }));
    }

    return jsonResponse(rpcResult(null, { settings: DEFAULT_SETTINGS }));
  } catch (error) {
    console.error("[api/users/me/mcp-settings] GET error:", error);
    return jsonResponse(rpcError(null, -32000, "Internal server error"), 500);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await authenticateRequestUser(req);
    if (!user?.id) {
      return jsonResponse(rpcError(null, -32001, "Unauthorized"), 401);
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return jsonResponse(rpcError(null, -32602, "Invalid JSON body"), 400);
    }

    const validation = parseAndValidateSettings(body);
    if (!validation.ok) {
      return jsonResponse(rpcError(null, -32602, validation.error), 400);
    }

    const now = new Date();

    const existing = await db
      .select()
      .from(userMcpSettings)
      .where(eq(userMcpSettings.userId, user.id))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(userMcpSettings)
        .set({
          settings: validation.settings,
          updatedAt: now,
        })
        .where(eq(userMcpSettings.userId, user.id));
    } else {
      await db.insert(userMcpSettings).values({
        id: nanoid(),
        userId: user.id,
        settings: validation.settings,
        createdAt: now,
        updatedAt: now,
      });
    }

    return jsonResponse(rpcResult(null, { settings: validation.settings }));
  } catch (error) {
    console.error("[api/users/me/mcp-settings] PATCH error:", error);
    return jsonResponse(rpcError(null, -32000, "Internal server error"), 500);
  }
}
