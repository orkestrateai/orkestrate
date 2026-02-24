ALTER TABLE "agent_telemetry"
  ADD COLUMN IF NOT EXISTS "user_id" uuid,
  ADD COLUMN IF NOT EXISTS "room_id" text;

DO $$
BEGIN
  ALTER TABLE "agent_telemetry"
    ADD CONSTRAINT "agent_telemetry_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

UPDATE "agent_telemetry"
SET "room_id" = COALESCE("room_id", payload->>'roomId', 'unassigned')
WHERE "room_id" IS NULL;

ALTER TABLE "agent_telemetry" ALTER COLUMN "room_id" SET DEFAULT 'unassigned';
ALTER TABLE "agent_telemetry" ALTER COLUMN "room_id" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "agent_telemetry_room_created_idx"
  ON "agent_telemetry" ("room_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "agent_telemetry_user_created_idx"
  ON "agent_telemetry" ("user_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "agent_telemetry_client_agent_created_idx"
  ON "agent_telemetry" ("client_id", "agent", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "agent_telemetry_payload_room_expr_idx"
  ON "agent_telemetry" ((payload->>'roomId'), "created_at" DESC);
