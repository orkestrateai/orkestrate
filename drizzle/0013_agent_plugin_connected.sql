ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "plugin_connected_at" timestamp;
CREATE INDEX IF NOT EXISTS "agents_plugin_connected_idx" ON "agents" ("plugin_connected_at");
