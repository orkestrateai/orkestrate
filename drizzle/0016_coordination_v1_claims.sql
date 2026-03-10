ALTER TABLE "agent_sessions"
  ADD COLUMN IF NOT EXISTS "normalized_remote" text;

ALTER TABLE "agent_sessions"
  ADD COLUMN IF NOT EXISTS "repo_root" text;

ALTER TABLE "agent_sessions"
  ADD COLUMN IF NOT EXISTS "head_sha_at_join" text;

ALTER TABLE "agent_sessions"
  ADD COLUMN IF NOT EXISTS "branch_at_join" text;

ALTER TABLE "agent_sessions"
  ADD COLUMN IF NOT EXISTS "tool_name_raw" text;

CREATE INDEX IF NOT EXISTS "agent_sessions_room_status_idx"
  ON "agent_sessions" ("room_id", "status");

ALTER TABLE "agent_states" DROP CONSTRAINT IF EXISTS "agent_states_status_check";
ALTER TABLE "agent_states"
  ADD CONSTRAINT "agent_states_status_check"
  CHECK ("status" IN ('active', 'idle', 'blocked', 'planning', 'handoff', 'done'));

CREATE TABLE IF NOT EXISTS "agent_scope_claims" (
  "id" text PRIMARY KEY,
  "room_id" text NOT NULL REFERENCES "rooms"("id") ON DELETE CASCADE,
  "agent_id" text NOT NULL REFERENCES "agents"("id") ON DELETE CASCADE,
  "session_id" text NOT NULL REFERENCES "agent_sessions"("id") ON DELETE CASCADE,
  "paths" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "status" text NOT NULL DEFAULT 'active',
  "lease_expires_at" timestamp NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "agent_scope_claims_status_check"
    CHECK ("status" IN ('active', 'released', 'expired'))
);

CREATE INDEX IF NOT EXISTS "agent_scope_claims_room_status_idx"
  ON "agent_scope_claims" ("room_id", "status");

CREATE INDEX IF NOT EXISTS "agent_scope_claims_agent_status_idx"
  ON "agent_scope_claims" ("agent_id", "status");

CREATE INDEX IF NOT EXISTS "agent_scope_claims_session_idx"
  ON "agent_scope_claims" ("session_id");
