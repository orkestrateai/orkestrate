ALTER TABLE "room_memberships" DROP CONSTRAINT IF EXISTS "room_memberships_room_id_rooms_id_fk";
ALTER TABLE "room_memberships"
  ADD CONSTRAINT "room_memberships_room_id_rooms_id_fk"
  FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "agents" DROP CONSTRAINT IF EXISTS "agents_room_id_rooms_id_fk";
ALTER TABLE "agents"
  ADD CONSTRAINT "agents_room_id_rooms_id_fk"
  FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "agents" DROP CONSTRAINT IF EXISTS "agents_room_member_fk";
ALTER TABLE "agents"
  ADD CONSTRAINT "agents_room_member_fk"
  FOREIGN KEY ("room_id","member_user_id") REFERENCES "public"."room_memberships"("room_id","user_id")
  ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "agent_sessions" DROP CONSTRAINT IF EXISTS "agent_sessions_agent_id_agents_id_fk";
ALTER TABLE "agent_sessions"
  ADD CONSTRAINT "agent_sessions_agent_id_agents_id_fk"
  FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "agent_sessions" DROP CONSTRAINT IF EXISTS "agent_sessions_room_id_rooms_id_fk";
ALTER TABLE "agent_sessions"
  ADD CONSTRAINT "agent_sessions_room_id_rooms_id_fk"
  FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "agent_states" DROP CONSTRAINT IF EXISTS "agent_states_agent_id_agents_id_fk";
ALTER TABLE "agent_states"
  ADD CONSTRAINT "agent_states_agent_id_agents_id_fk"
  FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "agent_states" DROP CONSTRAINT IF EXISTS "agent_states_session_id_agent_sessions_id_fk";
ALTER TABLE "agent_states"
  ADD CONSTRAINT "agent_states_session_id_agent_sessions_id_fk"
  FOREIGN KEY ("session_id") REFERENCES "public"."agent_sessions"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "agent_states" DROP CONSTRAINT IF EXISTS "agent_states_room_id_rooms_id_fk";
ALTER TABLE "agent_states"
  ADD CONSTRAINT "agent_states_room_id_rooms_id_fk"
  FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;
