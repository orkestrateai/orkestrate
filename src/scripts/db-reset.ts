/**
 * db-reset.ts — Wipes all Agentalk tables for a clean slate.
 * Usage: npx tsx src/scripts/db-reset.ts
 */
import 'dotenv/config';
import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    console.error('DATABASE_URL not set');
    process.exit(1);
}

const sql = postgres(connectionString, { prepare: false });

async function main() {
    console.log('🗑️  Wiping all Agentalk tables...\n');

    // Order matters: delete from tables with FK dependencies first
    await sql`DELETE FROM user_room_preferences`;
    console.log('  ✓ user_room_preferences');

    await sql`DELETE FROM room_memberships`;
    console.log('  ✓ room_memberships');

    await sql`DELETE FROM rooms`;
    console.log('  ✓ rooms');

    await sql`TRUNCATE TABLE agent_telemetry`;
    console.log('  ✓ agent_telemetry');

    await sql`TRUNCATE TABLE agent_states`;
    console.log('  ✓ agent_states');

    console.log('\n✅ All tables wiped. Clean slate ready.');
    await sql.end();
}

main().catch((err) => {
    console.error('Reset failed:', err);
    process.exit(1);
});
