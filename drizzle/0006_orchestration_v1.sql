CREATE TABLE IF NOT EXISTS "workspace_codebases" (
  "workspace_id" text PRIMARY KEY,
  "canonical_remote" text NOT NULL,
  "default_branch" text,
  "created_by" uuid NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

DO $$
BEGIN
  ALTER TABLE "workspace_codebases"
    ADD CONSTRAINT "workspace_codebases_workspace_id_rooms_id_fk"
    FOREIGN KEY ("workspace_id") REFERENCES "public"."rooms"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "workspace_codebases"
    ADD CONSTRAINT "workspace_codebases_created_by_users_id_fk"
    FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "workspace_codebases_canonical_remote_idx"
  ON "workspace_codebases" ("canonical_remote");

CREATE TABLE IF NOT EXISTS "agent_activity" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "workspace_id" text NOT NULL,
  "scoped_agent_id" text NOT NULL,
  "session_id" uuid,
  "event_type" text NOT NULL,
  "repo" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "payload" jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

DO $$
BEGIN
  ALTER TABLE "agent_activity"
    ADD CONSTRAINT "agent_activity_workspace_id_rooms_id_fk"
    FOREIGN KEY ("workspace_id") REFERENCES "public"."rooms"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "agent_activity_workspace_created_idx"
  ON "agent_activity" ("workspace_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "agent_activity_workspace_agent_created_idx"
  ON "agent_activity" ("workspace_id", "scoped_agent_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "agent_activity_workspace_event_created_idx"
  ON "agent_activity" ("workspace_id", "event_type", "created_at" DESC);

ALTER TABLE "knowledge_docs"
  ADD COLUMN IF NOT EXISTS "description" text DEFAULT '' NOT NULL;

CREATE INDEX IF NOT EXISTS "knowledge_docs_workspace_parent_updated_idx"
  ON "knowledge_docs" ("workspace_id", "parent_id", "updated_at" DESC);
