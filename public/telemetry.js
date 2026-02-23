const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const http = require('http');

// Parse arguments: node telemetry.js --agent=codex --client=agent-123 --host=example.com
function getArg(prefix, fallback = '') {
    const arg = process.argv.find(a => a.startsWith(prefix));
    return arg ? arg.split('=')[1] : fallback;
}

const agentType = getArg('--agent=', 'generic');
const clientId = getArg('--client=', 'unknown-agent');
const host = getArg('--host=', 'agentalk.vercel.app');
const roomId = getArg('--room=', 'default');

// ────────────────────────────────────────────────────────────
// PID FILE: Kill previous orphaned instances on startup
// ────────────────────────────────────────────────────────────
const PID_DIR = path.join(os.tmpdir(), 'agentalk');
const PID_FILE = path.join(PID_DIR, `telemetry-${agentType}.pid`);

function killPreviousInstance() {
    try {
        if (!fs.existsSync(PID_FILE)) return;
        const oldPid = parseInt(fs.readFileSync(PID_FILE, 'utf-8').trim(), 10);
        if (isNaN(oldPid) || oldPid === process.pid) return;

        // Check if the old process is still alive
        try {
            process.kill(oldPid, 0); // Signal 0 = existence check, doesn't actually kill
            console.log(`[Telemetry] Killing previous orphaned telemetry process (PID ${oldPid})`);
            process.kill(oldPid, 'SIGTERM');
        } catch (e) {
            // Process doesn't exist anymore, that's fine
        }
    } catch (e) {
        // PID file issues are non-fatal
    }
}

function writePidFile() {
    try {
        if (!fs.existsSync(PID_DIR)) fs.mkdirSync(PID_DIR, { recursive: true });
        fs.writeFileSync(PID_FILE, String(process.pid));
    } catch (e) {
        // Non-fatal
    }
}

function cleanupPidFile() {
    try {
        if (fs.existsSync(PID_FILE)) fs.unlinkSync(PID_FILE);
    } catch (e) {
        // Non-fatal
    }
}

// Kill any previous orphaned instance before we start
killPreviousInstance();
writePidFile();

console.log(`[Telemetry] Starting telemetry for ${clientId} (${agentType}) [PID: ${process.pid}]`);

// ────────────────────────────────────────────────────────────
// HTTP TRANSPORT
// ────────────────────────────────────────────────────────────
function sendLog(message, eventName = 'log') {
    const payload = JSON.stringify({ message, event: eventName });

    const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1');
    const requestModule = isLocalhost ? http : https;
    const port = isLocalhost ? parseInt(host.split(':')[1] || '3000', 10) : 443;
    const hostname = isLocalhost ? host.split(':')[0] : host;

    const options = {
        hostname: hostname,
        port: port,
        path: `/api/telemetry/ingest?clientId=${encodeURIComponent(clientId)}&agent=${encodeURIComponent(agentType)}&roomId=${encodeURIComponent(roomId)}`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload)
        }
    };

    const req = requestModule.request(options, (res) => {
        res.on('data', () => { });
    });

    req.on('error', (e) => {
        console.error(`[Telemetry] Failed to send log: ${e.message}`);
    });

    req.write(payload);
    req.end();
}

// Synchronous version for exit handlers (uses sync HTTP which is ugly but necessary)
function sendLogSync(message, eventName = 'log') {
    try {
        // We can't do async HTTP in 'exit' handlers, so we use a child_process trick
        const { execSync } = require('child_process');
        const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1');
        const protocol = isLocalhost ? 'http' : 'https';
        const port = isLocalhost ? (host.split(':')[1] || '3000') : '443';
        const hostname = isLocalhost ? host.split(':')[0] : host;
        const url = `${protocol}://${hostname}:${port}/api/telemetry/ingest?clientId=${encodeURIComponent(clientId)}&agent=${encodeURIComponent(agentType)}&roomId=${encodeURIComponent(roomId)}`;
        const body = JSON.stringify({ message, event: eventName });

        // Use curl/Invoke-WebRequest depending on platform
        if (process.platform === 'win32') {
            execSync(`powershell -Command "Invoke-WebRequest -Uri '${url}' -Method POST -Body '${body.replace(/'/g, "''")}' -ContentType 'application/json' -UseBasicParsing" 2>$null`, { timeout: 3000, stdio: 'ignore' });
        } else {
            execSync(`curl -s -X POST "${url}" -H "Content-Type: application/json" -d '${body.replace(/'/g, "'\\''")}'`, { timeout: 3000, stdio: 'ignore' });
        }
    } catch (e) {
        // Best-effort, don't crash on exit
    }
}

// ────────────────────────────────────────────────────────────
// HEARTBEAT: Send periodic pings so dashboard knows we're alive
// ────────────────────────────────────────────────────────────
const HEARTBEAT_INTERVAL = 15000; // 15 seconds
setInterval(() => {
    sendLog(JSON.stringify({ type: 'heartbeat', payload: { pid: process.pid, uptime: process.uptime() } }));
}, HEARTBEAT_INTERVAL);

// ────────────────────────────────────────────────────────────
// GRACEFUL SHUTDOWN: Send disconnect + cleanup PID file
// ────────────────────────────────────────────────────────────
let hasDisconnected = false;

function gracefulShutdown(signal) {
    if (hasDisconnected) return;
    hasDisconnected = true;

    console.log(`[Telemetry] ${signal} received. Sending disconnect signal...`);
    sendLogSync(JSON.stringify({ type: 'disconnect', payload: { reason: signal, pid: process.pid } }), 'system');
    cleanupPidFile();
}

process.on('SIGINT', () => { gracefulShutdown('SIGINT'); process.exit(0); });
process.on('SIGTERM', () => { gracefulShutdown('SIGTERM'); process.exit(0); });
process.on('exit', () => { gracefulShutdown('exit'); });

// ────────────────────────────────────────────────────────────
// FILE TAILING (Codex / Claude Code)
// ────────────────────────────────────────────────────────────
function tailNewestFile(baseDir, extension, logPrefix) {
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
            } else if (file.endsWith(extension) && stat.mtimeMs > newestTime) {
                newestTime = stat.mtimeMs;
                newestFile = fullPath;
            }
        }
    }

    searchDir(baseDir);

    if (!newestFile) {
        console.error(`[Telemetry] No ${logPrefix} session logs found in ${baseDir}`);
        return;
    }

    console.log(`[Telemetry] Tailing ${logPrefix} log file: ${newestFile}`);
    sendLog(`Started tailing ${logPrefix} log: ${newestFile}`, 'system');

    // Start from the beginning of the file to replay the full session history
    let fileSize = 0;

    fs.watchFile(newestFile, { interval: 500 }, (curr, prev) => {
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
                        // Filter out noisy events that waste bandwidth
                        try {
                            const evt = JSON.parse(text);
                            const t = evt.type;
                            const pt = evt.payload?.type;
                            // Skip: turn_context (repeats after every tool), token_count (fires constantly), 
                            // agent_message / user_message (duplicates of response_item)
                            if (t === 'turn_context') continue;
                            if (t === 'event_msg' && (pt === 'token_count' || pt === 'agent_message' || pt === 'user_message')) continue;
                        } catch (e) {
                            // Not JSON, send as-is
                        }
                        sendLog(text);
                    }
                }
            });

            fileSize = curr.size;
        }
    });
}

// ────────────────────────────────────────────────────────────
// SQLITE POLLING (OpenCode)
// ────────────────────────────────────────────────────────────
function startOpenCodeTailing() {
    let DatabaseSync;
    try {
        DatabaseSync = require('node:sqlite').DatabaseSync;
    } catch (e) {
        console.error('[Telemetry] node:sqlite is not available. You need Node.js v22.5.0+ to tail OpenCode.');
        return;
    }

    const dbPath = path.join(os.homedir(), '.local', 'share', 'opencode', 'opencode.db');
    if (!fs.existsSync(dbPath)) {
        console.error(`[Telemetry] OpenCode DB not found at ${dbPath}`);
        return;
    }

    console.log(`[Telemetry] Polling OpenCode SQLite database: ${dbPath}`);
    sendLog('Started tailing OpenCode database natively', 'system');

    let lastTimeCreated = Date.now();

    setInterval(() => {
        let db;
        try {
            db = new DatabaseSync(dbPath, { open: true });

            const rows = db.prepare('SELECT data, time_created FROM part WHERE time_created > ? ORDER BY time_created ASC').all(lastTimeCreated);

            for (const row of rows) {
                if (row.time_created > lastTimeCreated) {
                    lastTimeCreated = row.time_created;
                }

                if (row.data) {
                    try {
                        const parsed = JSON.parse(row.data);
                        const formattedLog = {
                            timestamp: new Date((parsed.time && parsed.time.start) || row.time_created || Date.now()).toISOString(),
                            type: parsed.type || 'unknown_event',
                            payload: parsed
                        };
                        sendLog(JSON.stringify(formattedLog));
                    } catch (e) {
                        sendLog(row.data.trim().replace(/\r?\n/g, ' '));
                    }
                }
            }

            db.close();
        } catch (e) {
            if (db) {
                try { db.close(); } catch (ce) { }
            }
        }
    }, 500);
}

// ────────────────────────────────────────────────────────────
// STARTUP
// ────────────────────────────────────────────────────────────

// Broadcast connection
sendLog(JSON.stringify({ type: 'connect', payload: { pid: process.pid, agent: agentType, client: clientId } }), 'system');

if (agentType === 'codex') {
    const dir = path.join(os.homedir(), '.codex', 'sessions');
    tailNewestFile(dir, '.jsonl', 'Codex');
} else if (agentType === 'claude-code' || agentType === 'claude') {
    const dir = path.join(os.homedir(), '.claude');
    tailNewestFile(dir, '.jsonl', 'Claude Code');
} else if (agentType === 'opencode') {
    startOpenCodeTailing();
} else {
    console.log('[Telemetry] Generic agent type, standing by for stdin...');
}

// Handle generic fallback (piped stdin)
process.stdin.on('data', (data) => {
    const text = data.toString().trim();
    if (text) {
        sendLog(text);
    }
});
