import { db } from "./src/db";
import { agentTelemetry } from "./src/db/schema";
import { like, desc, notLike } from "drizzle-orm";
import fs from "fs";

async function run() {
    const rows = await db
        .select({
            id: agentTelemetry.id,
            agent: agentTelemetry.agent,
            eventType: agentTelemetry.eventType,
            payload: agentTelemetry.payload,
            createdAt: agentTelemetry.createdAt,
        })
        .from(agentTelemetry)
        .where(like(agentTelemetry.agent, '%opencode%'))
        .orderBy(desc(agentTelemetry.createdAt))
        .limit(1000);

    // Filter for actual messages, not just pings
    const interesting = rows.filter(r => {
        try {
            const p = typeof r.payload === 'string' ? JSON.parse(r.payload) : r.payload;
            const m = typeof p.message === 'string' ? JSON.parse(p.message) : p.message;
            if (m?.type === 'ping' || m?.type === 'heartbeat' || m?.event === 'ping') return false;
            if (p?.event === 'ping' || p?.type === 'heartbeat') return false;
            return true;
        } catch {
            return true;
        }
    });

    fs.writeFileSync("tmp-telemetry.json", JSON.stringify(interesting.slice(0, 15), null, 2));
    console.log("Wrote to tmp-telemetry.json. Total interesting found: " + interesting.length);
    process.exit(0);
}

run().catch((err) => {
    console.error(err);
    process.exit(1);
});
