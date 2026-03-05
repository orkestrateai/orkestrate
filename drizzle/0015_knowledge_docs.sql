CREATE TABLE IF NOT EXISTS "knowledge_docs" (
  "id" text PRIMARY KEY,
  "room_id" text NOT NULL REFERENCES "rooms"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "description" text NOT NULL DEFAULT '',
  "content" text NOT NULL DEFAULT '',
  "parent_id" text,
  "is_folder" boolean NOT NULL DEFAULT false,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "knowledge_docs_room_idx"
  ON "knowledge_docs" ("room_id");

CREATE INDEX IF NOT EXISTS "knowledge_docs_room_parent_idx"
  ON "knowledge_docs" ("room_id", "parent_id");

CREATE INDEX IF NOT EXISTS "knowledge_docs_room_updated_idx"
  ON "knowledge_docs" ("room_id", "updated_at");

CREATE UNIQUE INDEX IF NOT EXISTS "knowledge_docs_room_parent_title_uq"
  ON "knowledge_docs" ("room_id", "parent_id", "title");
