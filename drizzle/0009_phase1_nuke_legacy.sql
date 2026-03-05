DROP TABLE IF EXISTS "agent_activity" CASCADE;
DROP TABLE IF EXISTS "agent_commands" CASCADE;
DROP TABLE IF EXISTS "agent_sessions" CASCADE;
DROP TABLE IF EXISTS "agent_states" CASCADE;
DROP TABLE IF EXISTS "agent_telemetry" CASCADE;
DROP TABLE IF EXISTS "agents" CASCADE;
DROP TABLE IF EXISTS "knowledge_docs" CASCADE;
DROP TABLE IF EXISTS "projects" CASCADE;
DROP TABLE IF EXISTS "tasks" CASCADE;
DROP TABLE IF EXISTS "workspace_codebases" CASCADE;
DROP TABLE IF EXISTS "room_events" CASCADE;
DROP TABLE IF EXISTS "user_room_preferences" CASCADE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'room_memberships_role_check'
      AND conrelid = 'public.room_memberships'::regclass
  ) THEN
    ALTER TABLE "room_memberships"
      DROP CONSTRAINT "room_memberships_role_check";
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'room_memberships_role_check'
      AND conrelid = 'public.room_memberships'::regclass
  ) THEN
    ALTER TABLE "room_memberships"
      ADD CONSTRAINT "room_memberships_role_check"
      CHECK ("role" IN ('owner', 'admin', 'member'));
  END IF;
END $$;
