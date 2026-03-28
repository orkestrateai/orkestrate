-- Migration 0020: Create user_mcp_settings table
-- Stores MCP tool permissions per user with category->enabledTools mapping

CREATE TABLE "user_mcp_settings" (
    "id" text PRIMARY KEY NOT NULL,
    "user_id" uuid NOT NULL REFERENCES "auth"."users"("id"),
    "settings" jsonb NOT NULL DEFAULT '{}',
    "created_at" timestamp NOT NULL DEFAULT NOW(),
    "updated_at" timestamp NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX "user_mcp_settings_user_idx" ON "user_mcp_settings"("user_id");
