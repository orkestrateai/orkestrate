CREATE INDEX IF NOT EXISTS "rooms_owner_user_idx"
  ON "rooms" ("owner_user_id");

CREATE INDEX IF NOT EXISTS "rooms_updated_idx"
  ON "rooms" ("updated_at" DESC);

CREATE INDEX IF NOT EXISTS "room_memberships_user_idx"
  ON "room_memberships" ("user_id");

CREATE INDEX IF NOT EXISTS "room_memberships_room_idx"
  ON "room_memberships" ("room_id");

CREATE INDEX IF NOT EXISTS "room_memberships_user_created_idx"
  ON "room_memberships" ("user_id", "created_at" DESC);

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

CREATE INDEX IF NOT EXISTS "user_room_preferences_active_room_idx"
  ON "user_room_preferences" ("active_room_id");
