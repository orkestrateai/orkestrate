CREATE TABLE IF NOT EXISTS "agents" (
  "id" text PRIMARY KEY NOT NULL,
  "member_user_id" uuid NOT NULL,
  "room_id" text NOT NULL,
  "client" text NOT NULL,
  "label" text NOT NULL,
  "status" text NOT NULL DEFAULT 'active',
  "last_message_at" timestamp NOT NULL DEFAULT now(),
  "disconnected_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "agents_member_user_id_members_user_id_fk"
    FOREIGN KEY ("member_user_id")
    REFERENCES "public"."members" ("user_id")
    ON DELETE no action ON UPDATE no action,
  CONSTRAINT "agents_room_id_rooms_id_fk"
    FOREIGN KEY ("room_id")
    REFERENCES "public"."rooms" ("id")
    ON DELETE no action ON UPDATE no action,
  CONSTRAINT "agents_room_member_fk"
    FOREIGN KEY ("room_id","member_user_id")
    REFERENCES "public"."room_memberships" ("room_id","user_id")
    ON DELETE no action ON UPDATE no action,
  CONSTRAINT "agents_status_check"
    CHECK ("status" IN ('active', 'idle', 'disconnected'))
);

CREATE INDEX IF NOT EXISTS "agents_member_idx" ON "agents" ("member_user_id");
CREATE INDEX IF NOT EXISTS "agents_room_idx" ON "agents" ("room_id");
CREATE INDEX IF NOT EXISTS "agents_status_idx" ON "agents" ("status");
CREATE INDEX IF NOT EXISTS "agents_last_message_idx" ON "agents" ("last_message_at");
CREATE UNIQUE INDEX IF NOT EXISTS "agents_member_label_uq" ON "agents" ("member_user_id", "label");

CREATE TABLE IF NOT EXISTS "agent_sessions" (
  "id" text PRIMARY KEY NOT NULL,
  "agent_id" text NOT NULL,
  "room_id" text NOT NULL,
  "status" text NOT NULL DEFAULT 'active',
  "started_at" timestamp NOT NULL DEFAULT now(),
  "ended_at" timestamp,
  "last_message_at" timestamp NOT NULL DEFAULT now(),
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "agent_sessions_agent_id_agents_id_fk"
    FOREIGN KEY ("agent_id")
    REFERENCES "public"."agents" ("id")
    ON DELETE no action ON UPDATE no action,
  CONSTRAINT "agent_sessions_room_id_rooms_id_fk"
    FOREIGN KEY ("room_id")
    REFERENCES "public"."rooms" ("id")
    ON DELETE no action ON UPDATE no action,
  CONSTRAINT "agent_sessions_status_check"
    CHECK ("status" IN ('active', 'ended', 'disconnected', 'stale'))
);

CREATE INDEX IF NOT EXISTS "agent_sessions_agent_idx" ON "agent_sessions" ("agent_id");
CREATE INDEX IF NOT EXISTS "agent_sessions_room_idx" ON "agent_sessions" ("room_id");
CREATE INDEX IF NOT EXISTS "agent_sessions_status_idx" ON "agent_sessions" ("status");
CREATE INDEX IF NOT EXISTS "agent_sessions_last_message_idx" ON "agent_sessions" ("last_message_at");

CREATE TABLE IF NOT EXISTS "agent_states" (
  "id" text PRIMARY KEY NOT NULL,
  "agent_id" text NOT NULL,
  "session_id" text NOT NULL,
  "room_id" text NOT NULL,
  "status" text NOT NULL DEFAULT 'active',
  "objective" text NOT NULL DEFAULT '',
  "claimed_paths" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "plan" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "completed" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "notes" text NOT NULL DEFAULT '',
  "version" text NOT NULL DEFAULT 'v0',
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "agent_states_agent_id_agents_id_fk"
    FOREIGN KEY ("agent_id")
    REFERENCES "public"."agents" ("id")
    ON DELETE no action ON UPDATE no action,
  CONSTRAINT "agent_states_session_id_agent_sessions_id_fk"
    FOREIGN KEY ("session_id")
    REFERENCES "public"."agent_sessions" ("id")
    ON DELETE no action ON UPDATE no action,
  CONSTRAINT "agent_states_room_id_rooms_id_fk"
    FOREIGN KEY ("room_id")
    REFERENCES "public"."rooms" ("id")
    ON DELETE no action ON UPDATE no action,
  CONSTRAINT "agent_states_status_check"
    CHECK ("status" IN ('active', 'idle', 'blocked'))
);

CREATE INDEX IF NOT EXISTS "agent_states_agent_idx" ON "agent_states" ("agent_id");
CREATE UNIQUE INDEX IF NOT EXISTS "agent_states_session_idx" ON "agent_states" ("session_id");
CREATE INDEX IF NOT EXISTS "agent_states_room_idx" ON "agent_states" ("room_id");
