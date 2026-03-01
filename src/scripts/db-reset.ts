/**
 * db-reset.ts - Wipes Orkestrate tables for a clean slate.
 * Usage: npx tsx src/scripts/db-reset.ts
 */
import "dotenv/config";
import postgres from "postgres";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const sql = postgres(connectionString, { prepare: false });

async function main() {
  console.log("Wiping Orkestrate tables...\n");

  // Delete child tables first.
  await sql`TRUNCATE TABLE agent_activity`;
  console.log("  ok agent_activity");

  await sql`TRUNCATE TABLE agent_commands`;
  console.log("  ok agent_commands");

  await sql`TRUNCATE TABLE knowledge_docs`;
  console.log("  ok knowledge_docs");

  await sql`TRUNCATE TABLE workspace_codebases`;
  console.log("  ok workspace_codebases");

  await sql`TRUNCATE TABLE agent_telemetry`;
  console.log("  ok agent_telemetry");

  await sql`TRUNCATE TABLE agent_states`;
  console.log("  ok agent_states");

  await sql`TRUNCATE TABLE agent_sessions`;
  console.log("  ok agent_sessions");

  await sql`TRUNCATE TABLE tasks`;
  console.log("  ok tasks");

  await sql`TRUNCATE TABLE projects`;
  console.log("  ok projects");

  await sql`DELETE FROM user_room_preferences`;
  console.log("  ok user_room_preferences");

  await sql`DELETE FROM room_memberships`;
  console.log("  ok room_memberships");

  await sql`DELETE FROM rooms`;
  console.log("  ok rooms");

  console.log("\nDone.");
  await sql.end();
}

main().catch((err) => {
  console.error("Reset failed:", err);
  process.exit(1);
});
