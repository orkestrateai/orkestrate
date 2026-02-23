const fs = require('fs');
const path = require('path');
const os = require('os');
const pty = require('node-pty');
const { createClient } = require('@supabase/supabase-js');

// ────────────────────────────────────────────────────────────
// 1. CONFIGURATION & ENVIRONMENT
// ────────────────────────────────────────────────────────────
// ────────────────────────────────────────────────────────────
// 1. CONFIGURATION & ENVIRONMENT
// ────────────────────────────────────────────────────────────
function getArg(prefix, fallback = '') {
    const arg = process.argv.find(a => a.startsWith(prefix));
    return arg ? arg.split('=')[1] : fallback;
}

// Support .env if it exists locally
try {
    const envPath = path.join(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
        require('dotenv').config({ path: envPath });
    }
} catch (e) { }

const agentType = getArg('--agent=', 'codex');
const clientId = getArg('--client=', 'user-' + os.userInfo().username);
const host = getArg('--host=', 'agentalk.vercel.app');
const roomId = getArg('--room=', 'default');
const supabaseUrl = getArg('--url=', process.env.NEXT_PUBLIC_SUPABASE_URL);
const supabaseKey = getArg('--key=', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const rawArgs = process.argv.slice(2);
const positionalArgs = rawArgs.filter(arg => !arg.startsWith('--'));
const targetCommand = positionalArgs[0] || 'codex';

const BASE_HOST = host.includes('://') ? host : (host.includes('localhost') ? `http://${host}` : `https://${host}`);
let supabase = null;
if (supabaseUrl && supabaseKey) {
    supabase = createClient(supabaseUrl, supabaseKey);
}

let lastSeenCommandTime = new Date().toISOString();

// ────────────────────────────────────────────────────────────
// 2. ORCHESTRATE CODEX PROCESS
// ────────────────────────────────────────────────────────────
let childArgs = [];
const commandArgs = positionalArgs.slice(1);
if (commandArgs.length > 0) {
    childArgs = commandArgs;
}

console.log(`\x1b[36m[Agentalk]\x1b[0m Spawning proxy for: ${targetCommand} ${childArgs.join(' ')}\n`);

const isWinOS = process.platform === 'win32';
const ptyProcess = pty.spawn(isWinOS ? 'cmd.exe' : targetCommand, isWinOS ? ['/c', targetCommand, ...childArgs] : childArgs, {
    name: 'xterm-color',
    cols: process.stdout.columns || 80,
    rows: process.stdout.rows || 24,
    cwd: process.cwd(),
    env: process.env
});

// Allow local terminal input to flow into the child process when running interactively.
// If launched detached (e.g. Start-Process -NoNewWindow), stdin may not be a TTY.
if (process.stdin && process.stdin.isTTY && typeof process.stdin.setRawMode === 'function') {
    process.stdin.setRawMode(true);
    process.stdin.on('data', (data) => {
        ptyProcess.write(data);
    });
} else {
    console.log('\x1b[33m[Agentalk]\x1b[0m No interactive TTY detected. Running in headless proxy mode.');
}

ptyProcess.onData((data) => {
    process.stdout.write(data);
});

// Propagate resize events
process.stdout.on('resize', () => {
    ptyProcess.resize(process.stdout.columns, process.stdout.rows);
});

ptyProcess.onExit(({ exitCode, signal }) => {
    sendLog(JSON.stringify({ type: 'disconnect', payload: { reason: signal || 'exit', pid: process.pid } }), 'system');
    process.exit(exitCode || 0);
});

// ────────────────────────────────────────────────────────────
// 3. INBOUND: TWO-WAY COMMUNICATION VIA HTTP POLLING
// ────────────────────────────────────────────────────────────
function pollCommands() {
    const isLocalhost = BASE_HOST.includes('localhost') || BASE_HOST.includes('127.0.0.1');
    const requestModule = isLocalhost ? require('http') : require('https');

    const url = new URL(`${BASE_HOST}/api/telemetry/commands?clientId=${encodeURIComponent(clientId)}&agent=${encodeURIComponent(agentType)}&roomId=${encodeURIComponent(roomId)}&since=${encodeURIComponent(lastSeenCommandTime)}`);

    const req = requestModule.request(url, {
        method: 'GET',
    }, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
            if (res.statusCode === 200) {
                try {
                    const data = JSON.parse(body);
                    if (data.commands && data.commands.length > 0) {
                        data.commands.forEach(cmd => {
                            const rawMsg = cmd.payload?.message;
                            if (rawMsg) {
                                console.log(`\r\n\x1b[35m[Remote Input]\x1b[0m ${rawMsg}`);
                                ptyProcess.write(rawMsg + '\r');
                            }
                            if (cmd.created_at > lastSeenCommandTime) {
                                lastSeenCommandTime = cmd.created_at;
                            }
                        });
                    }
                } catch (e) {
                    // JSON parse error
                }
            }
        });
    });

    req.on('error', () => { /* Prevent crash if backend is down */ });
    req.end();
}

// Start polling every 2 seconds
console.log('\x1b[32m[Agentalk]\x1b[0m Remote command polling started (2s interval).');
setInterval(pollCommands, 2000);

// ────────────────────────────────────────────────────────────
// 4. OUTBOUND: TELEMETRY POLLING TO HTTP ENDPOINT
// ────────────────────────────────────────────────────────────
function sendLog(message, eventName = 'log') {
    const payloadData = { message, event: eventName, roomId };
    const jsonPayload = JSON.stringify(payloadData);

    // 1. Direct Supabase Path (Fast & Bulletproof)
    if (supabase) {
        // Broadast for Realtime Dashboard
        supabase.channel('telemetry:live').send({
            type: 'broadcast',
            event: 'log',
            payload: {
                timestamp: new Date().toISOString(),
                clientId: clientId,
                agent: agentType,
                roomId: roomId,
                ...payloadData
            }
        });

        // Insert for Persistence
        supabase.from('agent_telemetry').insert({
            client_id: clientId,
            agent: agentType,
            event_type: eventName,
            payload: payloadData,
            created_at: new Date().toISOString()
        }).then(({ error }) => { if (error) console.error('[Telemetry] DB Error:', error.message); });
    }

    // 2. HTTP REST Path (Portability)
    const isLocalhost = BASE_HOST.includes('localhost') || BASE_HOST.includes('127.0.0.1');
    const requestModule = isLocalhost ? require('http') : require('https');

    const url = new URL(`${BASE_HOST}/api/telemetry/ingest?clientId=${encodeURIComponent(clientId)}&agent=${encodeURIComponent(agentType)}&roomId=${encodeURIComponent(roomId)}`);

    const req = requestModule.request(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(jsonPayload)
        }
    }, (res) => { res.on('data', () => { }); });

    req.on('error', () => { /* Silent */ });
    req.write(jsonPayload);
    req.end();
}

// Heartbeat
setInterval(() => {
    sendLog(JSON.stringify({ type: 'heartbeat', payload: { pid: process.pid, uptime: process.uptime() } }));
}, 15000);

sendLog(JSON.stringify({ type: 'connect', payload: { pid: process.pid, agent: agentType, client: clientId, features: ['two_way'] } }), 'system');
// Explicit signal for the UI to enable the chat input
sendLog('#two_way_ready', 'system');
// Re-emit periodically so refreshed dashboards can detect two-way readiness quickly.
setInterval(() => {
    sendLog('#two_way_ready', 'system');
}, 30000);

// Find and stream the newest Codex logs exactly like telemetry.js did
function tailNewestFile(baseDir, logPrefix) {
    let newestFile = '';
    let newestTime = 0;

    function searchDir(dir) {
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

    searchDir(baseDir);

    if (!newestFile) {
        // Retry silently until a session file is generated
        setTimeout(() => tailNewestFile(baseDir, logPrefix), 2000);
        return;
    }

    // console.log(`\x1b[36m[Agentalk]\x1b[0m Tailing ${logPrefix} telemetry log...`);
    sendLog(`Started tailing ${logPrefix} log: ${newestFile}`, 'system');

    // Replay session history from start
    let fileSize = 0;

    fs.watchFile(newestFile, { interval: 500 }, (curr) => {
        if (curr.size > fileSize) {
            const stream = fs.createReadStream(newestFile, {
                encoding: 'utf-8',
                start: fileSize,
                end: curr.size
            });

            let buffer = '';
            stream.on('data', (chunk) => {
                buffer += chunk;
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    const text = line.trim();
                    if (text) {
                        try {
                            const evt = JSON.parse(text);
                            const t = evt.type;
                            const pt = evt.payload?.type;
                            // Bandwidth Noise Filter
                            if (t === 'turn_context') continue;
                            if (t === 'event_msg' && (pt === 'token_count' || pt === 'agent_message' || pt === 'user_message')) continue;
                        } catch (e) { }
                        sendLog(text);
                    }
                }
            });

            fileSize = curr.size;
        }
    });
}

// Wait briefly for Codex to initialize its new session file before scanning
setTimeout(() => {
    const dir = path.join(os.homedir(), '.codex', 'sessions');
    tailNewestFile(dir, 'Codex');
}, 1500);
