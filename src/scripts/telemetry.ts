import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials. Make sure to run with --env-file=.env.local");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
// We can interpret the args like: node telemetry.ts --agent codex <clientId>
const agentType = process.argv.find(arg => arg.startsWith('--agent='))?.split('=')[1] || 'generic';
const clientId = process.argv[process.argv.length - 1] || 'unknown-agent';

// Create a unique channel for this agent's telemetry
const channel = supabase.channel(`telemetry:${clientId}`, {
    config: {
        broadcast: { ack: false }
    }
});

channel.subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
        console.log(`[Telemetry] Connected to Supabase Realtime (telemetry:${clientId} | mode: ${agentType})`);

        await channel.send({
            type: 'broadcast',
            event: 'log',
            payload: { timestamp: new Date().toISOString(), message: `[SYSTEM] ${clientId} telemetry stream online for agent: ${agentType}.` }
        });

        // If the agent is Codex, initialize the active log tailing
        if (agentType === 'codex') {
            startCodexTailing();
        }
    }
});

/**
 * Finds the latest modified JSONL session log for Codex and tails it.
 */
function startCodexTailing() {
    const codexSessionsDir = path.join(os.homedir(), '.codex', 'sessions');

    // Quick helper to recursively find the newest jsonl file
    let newestFile = '';
    let newestTime = 0;

    function searchDir(dir: string) {
        if (!fs.existsSync(dir)) return;
        const files = fs.readdirSync(dir);
        for (const file of files) {
            const fullPath = path.join(dir, file);
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory()) {
                searchDir(fullPath);
            } else if (file.endsWith('.jsonl') && stat.mtimeMs > newestTime) {
                newestTime = stat.mtimeMs;
                newestFile = fullPath;
            }
        }
    }

    searchDir(codexSessionsDir);

    if (!newestFile) {
        console.error(`[Telemetry] No Codex session logs found in ${codexSessionsDir}`);
        return;
    }

    console.log(`[Telemetry] Tailing Codex log file: ${newestFile}`);
    let fileSize = fs.statSync(newestFile).size;

    // Watch the file for changes
    fs.watchFile(newestFile, { interval: 500 }, (curr, prev) => {
        if (curr.size > fileSize) {
            const stream = fs.createReadStream(newestFile, {
                encoding: 'utf-8',
                start: fileSize,
                end: curr.size
            });

            stream.on('data', async (chunk) => {
                const text = chunk.toString().trim();
                if (text) {
                    await channel.send({
                        type: 'broadcast',
                        event: 'log',
                        payload: { timestamp: new Date().toISOString(), message: text }
                    });
                }
            });

            fileSize = curr.size;
        }
    });
}

// Pipe stdin chunks directly to the websocket broadcast as a generic fallback/additional input
process.stdin.on('data', async (data) => {
    const text = data.toString().trim();
    if (!text) return;

    await channel.send({
        type: 'broadcast',
        event: 'log',
        payload: { timestamp: new Date().toISOString(), message: text }
    });
});

process.stdin.on('end', () => {
    setTimeout(() => {
        process.exit(0);
    }, 500);
});
