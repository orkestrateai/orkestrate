-- Drop all Orkestrate tables (in reverse dependency order)
DROP TABLE IF EXISTS agent_scope_claims CASCADE;
DROP TABLE IF EXISTS agent_states CASCADE;
DROP TABLE IF EXISTS agent_sessions CASCADE;
DROP TABLE IF EXISTS agents CASCADE;
DROP TABLE IF EXISTS knowledge_docs CASCADE;
DROP TABLE IF EXISTS workspace_invites CASCADE;
DROP TABLE IF EXISTS members CASCADE;
DROP TABLE IF EXISTS workspaces CASCADE;
DROP TABLE IF EXISTS github_tokens CASCADE;
DROP TABLE IF EXISTS subscriptions CASCADE;
-- Run all migrations
\i drizzle/0010_agents_sessions_states.sql
\i drizzle/0011_room_delete_cascade.sql
\i drizzle/0012_members_workspace_scoped.sql
\i drizzle/0013_agent_plugin_connected.sql
\i drizzle/0014_agent_session_transcript.sql
\i drizzle/0015_knowledge_docs.sql
\i drizzle/0016_coordination_v1_claims.sql
\i drizzle/0017_bouncy_gideon.sql
\i drizzle/0018_rename_columns.sql
