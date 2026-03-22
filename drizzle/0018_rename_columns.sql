ALTER TABLE "agent_states" RENAME COLUMN "claimed_paths" TO "footprint";
ALTER TABLE "agents" RENAME COLUMN "client" TO "tool_name";
