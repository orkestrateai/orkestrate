CREATE TABLE IF NOT EXISTS "members" (
  "user_id" uuid PRIMARY KEY NOT NULL,
  "active_room_id" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

DO $$
BEGIN
  ALTER TABLE "members"
    ADD CONSTRAINT "members_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "members_active_room_idx"
  ON "members" ("active_room_id");

INSERT INTO "members" ("user_id", "active_room_id", "created_at", "updated_at")
SELECT DISTINCT "user_id", NULL, now(), now()
FROM "room_memberships"
ON CONFLICT ("user_id") DO NOTHING;

DO $$
BEGIN
  IF to_regclass('public.user_room_preferences') IS NOT NULL THEN
    INSERT INTO "members" ("user_id", "active_room_id", "created_at", "updated_at")
    SELECT
      urp."user_id",
      urp."active_room_id",
      COALESCE(urp."updated_at", now()),
      COALESCE(urp."updated_at", now())
    FROM "user_room_preferences" urp
    ON CONFLICT ("user_id") DO UPDATE
      SET "active_room_id" = excluded."active_room_id",
          "updated_at" = excluded."updated_at";
  END IF;
END $$;

UPDATE "members" m
SET "active_room_id" = NULL,
    "updated_at" = now()
WHERE m."active_room_id" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "room_memberships" rm
    WHERE rm."room_id" = m."active_room_id"
      AND rm."user_id" = m."user_id"
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'members_active_room_membership_fk'
      AND conrelid = 'public.members'::regclass
  ) THEN
    ALTER TABLE "members"
      ADD CONSTRAINT "members_active_room_membership_fk"
      FOREIGN KEY ("active_room_id", "user_id")
      REFERENCES "public"."room_memberships"("room_id", "user_id")
      ON DELETE no action
      ON UPDATE no action;
  END IF;
END $$;

DROP TABLE IF EXISTS "user_room_preferences";
