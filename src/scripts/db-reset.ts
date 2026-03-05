/**
 * db-reset.ts - Wipes phase-1 auth/rooms tables for a clean slate.
 * Usage: bun src/scripts/db-reset.ts
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
  console.log("Wiping phase-1 tables...\n");

  await sql`DELETE FROM rooms`;
  console.log("  ok rooms");

  await sql`DELETE FROM members`;
  console.log("  ok members");

  console.log("\nDone.");
  await sql.end();
}

main().catch((err) => {
  console.error("Reset failed:", err);
  process.exit(1);
});
