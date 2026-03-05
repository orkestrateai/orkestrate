ALTER TABLE "agent_sessions"
  ADD COLUMN IF NOT EXISTS "transcript" jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE "agent_sessions"
  ADD COLUMN IF NOT EXISTS "transcript_updated_at" timestamp;

CREATE INDEX IF NOT EXISTS "agent_sessions_transcript_updated_idx"
  ON "agent_sessions" ("transcript_updated_at");
