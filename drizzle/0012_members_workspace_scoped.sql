ALTER TABLE "agents" DROP CONSTRAINT IF EXISTS "agents_member_user_id_members_user_id_fk";
ALTER TABLE "agents" DROP CONSTRAINT IF EXISTS "agents_room_member_fk";
DROP INDEX IF EXISTS "agents_member_label_uq";
DROP INDEX IF EXISTS "agents_member_idx";

ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "member_id" text;

CREATE TABLE IF NOT EXISTS "members_v2" (
  "id" text PRIMARY KEY NOT NULL,
  "room_id" text NOT NULL,
  "user_id" uuid NOT NULL,
  "role" text NOT NULL DEFAULT 'member',
  "is_active" boolean NOT NULL DEFAULT false,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

ALTER TABLE "members_v2" DROP CONSTRAINT IF EXISTS "members_v2_room_id_rooms_id_fk";
ALTER TABLE "members_v2"
  ADD CONSTRAINT "members_v2_room_id_rooms_id_fk"
  FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "members_v2" DROP CONSTRAINT IF EXISTS "members_v2_user_id_users_id_fk";
ALTER TABLE "members_v2"
  ADD CONSTRAINT "members_v2_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id")
  ON DELETE NO ACTION ON UPDATE NO ACTION;

INSERT INTO "members_v2" ("id", "room_id", "user_id", "role", "is_active", "created_at", "updated_at")
SELECT
  'mem_' || substr(md5(rm."room_id" || ':' || rm."user_id"::text), 1, 12) AS id,
  rm."room_id",
  rm."user_id",
  CASE
    WHEN rm."role" IN ('owner', 'admin', 'member') THEN rm."role"
    ELSE 'member'
  END,
  CASE
    WHEN m."active_room_id" IS NOT NULL AND m."active_room_id" = rm."room_id" THEN true
    ELSE false
  END,
  COALESCE(rm."created_at", now()),
  now()
FROM "room_memberships" rm
LEFT JOIN "members" m
  ON m."user_id" = rm."user_id"
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "members_v2" ("id", "room_id", "user_id", "role", "is_active", "created_at", "updated_at")
SELECT
  'mem_' || substr(md5(r."id" || ':' || r."owner_user_id"::text), 1, 12) AS id,
  r."id",
  r."owner_user_id",
  'owner',
  true,
  r."created_at",
  now()
FROM "rooms" r
WHERE NOT EXISTS (
  SELECT 1
  FROM "members_v2" mv2
  WHERE mv2."room_id" = r."id" AND mv2."user_id" = r."owner_user_id"
)
ON CONFLICT ("id") DO NOTHING;

UPDATE "members_v2" mv2
SET "is_active" = true
WHERE NOT EXISTS (
  SELECT 1
  FROM "members_v2" x
  WHERE x."user_id" = mv2."user_id"
    AND x."is_active" = true
)
AND mv2."id" = (
  SELECT y."id"
  FROM "members_v2" y
  WHERE y."user_id" = mv2."user_id"
  ORDER BY y."created_at" DESC, y."id" ASC
  LIMIT 1
);

UPDATE "agents" a
SET "member_id" = mv2."id"
FROM "members_v2" mv2
WHERE mv2."room_id" = a."room_id"
  AND mv2."user_id" = a."member_user_id";

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "agents" WHERE "member_id" IS NULL) THEN
    RAISE EXCEPTION 'Migration 0012 failed: some agents could not be mapped to members_v2';
  END IF;
END $$;

DROP TABLE IF EXISTS "members";
ALTER TABLE "members_v2" RENAME TO "members";
DROP TABLE IF EXISTS "room_memberships";

ALTER TABLE "agents" ALTER COLUMN "member_id" SET NOT NULL;
ALTER TABLE "agents" DROP COLUMN IF EXISTS "member_user_id";

ALTER TABLE "agents" DROP CONSTRAINT IF EXISTS "agents_member_id_members_id_fk";
ALTER TABLE "agents"
  ADD CONSTRAINT "agents_member_id_members_id_fk"
  FOREIGN KEY ("member_id") REFERENCES "public"."members"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;

CREATE UNIQUE INDEX IF NOT EXISTS "members_room_user_uq" ON "members" ("room_id","user_id");
CREATE INDEX IF NOT EXISTS "members_user_idx" ON "members" ("user_id");
CREATE INDEX IF NOT EXISTS "members_room_idx" ON "members" ("room_id");
CREATE INDEX IF NOT EXISTS "members_user_active_idx" ON "members" ("user_id","is_active");

CREATE INDEX IF NOT EXISTS "agents_member_idx" ON "agents" ("member_id");
CREATE UNIQUE INDEX IF NOT EXISTS "agents_member_label_uq" ON "agents" ("member_id","label");
