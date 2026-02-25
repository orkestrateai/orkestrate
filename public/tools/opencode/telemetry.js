const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const https = require('https');
const http = require('http');

function getArg(prefix, fallback = '') {
    const arg = process.argv.find((a) => a.startsWith(prefix));
    return arg ? arg.split('=')[1] : fallback;
}

const agentType = getArg('--agent=', 'generic');
const clientId = getArg('--client=', 'unknown-agent');
const host = getArg('--host=', 'agentalk.vercel.app');
const roomId = getArg('--room=', 'unassigned');

function resolveEndpoint(hostValue) {
    const normalized = hostValue.includes('://')
        ? hostValue
        : (hostValue.includes('localhost') || hostValue.includes('127.0.0.1')
            ? `http://${hostValue}`
            : `https://${hostValue}`);
    const url = new URL(normalized);
    const protocol = url.protocol === 'http:' ? 'http:' : 'https:';
    const port = url.port
        ? Number(url.port)
        : (protocol === 'http:' ? 80 : 443);

    return {
        protocol,
        hostname: url.hostname,
        port,
        isLocal: protocol === 'http:',
    };
}

const endpoint = resolveEndpoint(host);
const INGEST_PATH = `/api/telemetry/ingest?clientId=${encodeURIComponent(clientId)}&agent=${encodeURIComponent(agentType)}&roomId=${encodeURIComponent(roomId)}`;
const INGEST_URL = `${endpoint.protocol}//${endpoint.hostname}:${endpoint.port}${INGEST_PATH}`;

// Keep one telemetry process per client/room/host tuple.
// If agent id changes unexpectedly, this still guarantees one active streamer.
const PID_DIR = path.join(os.tmpdir(), 'agentalk');
const pidIdentity = `${clientId}|${roomId}|${endpoint.hostname}:${endpoint.port}`;
const pidKey = crypto.createHash('sha1').update(pidIdentity).digest('hex').slice(0, 12);
const PID_FILE = path.join(PID_DIR, `telemetry-${pidKey}.pid`);

function killPreviousInstance() {
    try {
        if (!fs.existsSync(PID_FILE)) return;
        const oldPid = parseInt(fs.readFileSync(PID_FILE, 'utf-8').trim(), 10);
        if (isNaN(oldPid) || oldPid === process.pid) return;

        try {
            process.kill(oldPid, 0);
            console.log(`[Telemetry] Killing previous orphaned telemetry process (PID ${oldPid})`);
            process.kill(oldPid, 'SIGTERM');
        } catch (e) {
            // Process does not exist.
        }
    } catch (e) {
        // Ignore pid file read errors.
    }
}

function writePidFile() {
    try {
        if (!fs.existsSync(PID_DIR)) fs.mkdirSync(PID_DIR, { recursive: true });
        fs.writeFileSync(PID_FILE, String(process.pid));
    } catch (e) {
        // Ignore pid file write errors.
    }
}

function cleanupPidFile() {
    try {
        if (fs.existsSync(PID_FILE)) fs.unlinkSync(PID_FILE);
    } catch (e) {
        // Ignore pid file cleanup errors.
    }
}

killPreviousInstance();
writePidFile();

console.log(`[Telemetry] Starting telemetry for ${clientId} (${agentType}) [PID: ${process.pid}]`);

let lastTransportErrorAt = 0;
function logTransportError(message) {
    const now = Date.now();
    if (now - lastTransportErrorAt < 5000) return;
    lastTransportErrorAt = now;
    console.error(message);
}

function postPayload(payload) {
    return new Promise((resolve) => {
        const requestModule = endpoint.isLocal ? http : https;
        const req = requestModule.request({
            hostname: endpoint.hostname,
            port: endpoint.port,
            path: INGEST_PATH,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload),
            },
        }, (res) => {
            if (res.statusCode && res.statusCode >= 400) {
                logTransportError(`[Telemetry] Ingest returned HTTP ${res.statusCode}`);
            }
            res.on('data', () => { });
            res.on('end', resolve);
        });

        req.on('error', (e) => {
            logTransportError(`[Telemetry] Failed to send log: ${e.message}`);
            resolve();
        });

        req.write(payload);
        req.end();
    });
}

const MAX_QUEUE_SIZE = 5000;
const SEND_CONCURRENCY = 4;
const sendQueue = [];
let inFlight = 0;
let droppedLogs = 0;

function pumpQueue() {
    while (inFlight < SEND_CONCURRENCY && sendQueue.length > 0) {
        const payload = sendQueue.shift();
        inFlight += 1;

        postPayload(payload).finally(() => {
            inFlight -= 1;
            if (sendQueue.length === 0 && droppedLogs > 0) {
                console.warn(`[Telemetry] Dropped ${droppedLogs} logs due to queue pressure.`);
                droppedLogs = 0;
            }
            pumpQueue();
        });
    }
}

function sendLog(message, eventName = 'log') {
    const payload = JSON.stringify({ message, event: eventName });
    if (sendQueue.length >= MAX_QUEUE_SIZE) {
        sendQueue.shift();
        droppedLogs += 1;
    }
    sendQueue.push(payload);
    pumpQueue();
}

function sendLogSync(message, eventName = 'log') {
    try {
        const { execSync } = require('child_process');
        const body = JSON.stringify({ message, event: eventName });

        // Write body to a temp file to avoid shell injection via interpolation
        const tmpFile = path.join(os.tmpdir(), `agentalk_sync_${process.pid}.json`);
        fs.writeFileSync(tmpFile, body);

        try {
            if (process.platform === 'win32') {
                execSync(`powershell -Command "Invoke-WebRequest -Uri '${INGEST_URL}' -Method POST -Body (Get-Content -Raw '${tmpFile}') -ContentType 'application/json' -UseBasicParsing" 2>$null`, { timeout: 3000, stdio: 'ignore' });
            } else {
                execSync(`curl -s -X POST '${endpoint.protocol}//${endpoint.hostname}:${endpoint.port}${INGEST_PATH}' -H 'Content-Type: application/json' -d @'${tmpFile}'`, { timeout: 3000, stdio: 'ignore' });
            }
        } finally {
            try { fs.unlinkSync(tmpFile); } catch (_) { }
        }
    } catch (e) {
        // Best effort only.
    }
}

const HEARTBEAT_INTERVAL = 15000;
setInterval(() => {
    sendLog(JSON.stringify({ type: 'heartbeat', payload: { pid: process.pid, uptime: process.uptime() } }));
}, HEARTBEAT_INTERVAL);

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

function shouldDropNoisyEvent(text) {
    try {
        const evt = JSON.parse(text);
        const t = evt.type;
        const pt = evt.payload?.type;
        if (t === 'turn_context') return true;
        if (t === 'event_msg' && (pt === 'token_count' || pt === 'agent_message' || pt === 'user_message')) return true;
    } catch (e) {
        // Non-JSON log line.
    }
    return false;
}

function findNewestFile(baseDir, extension) {
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
    return newestFile;
}

function startFileTailer(baseDir, extension, logPrefix) {
    let activeFile = '';
    let fileSize = 0;
    let watcher = null;
    let warnedNoFile = false;

    function attachFile(filePath) {
        if (watcher && activeFile) {
            fs.unwatchFile(activeFile, watcher);
        }

        activeFile = filePath;
        fileSize = 0;

        console.log(`[Telemetry] Tailing ${logPrefix} log file: ${activeFile}`);
        sendLog(`Started tailing ${logPrefix} log: ${activeFile}`, 'system');

        watcher = (curr) => {
            if (curr.size < fileSize) {
                fileSize = 0;
            }
            if (curr.size <= fileSize) {
                return;
            }

            const start = fileSize;
            const end = curr.size;
            fileSize = end;

            const stream = fs.createReadStream(activeFile, {
                encoding: 'utf-8',
                start,
                end,
            });

            let buffer = '';
            stream.on('data', (chunk) => {
                buffer += chunk;
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    const text = line.trim();
                    if (!text) continue;
                    if (shouldDropNoisyEvent(text)) continue;
                    sendLog(text);
                }
            });

            stream.on('error', (e) => {
                logTransportError(`[Telemetry] Failed reading tailed file: ${e.message}`);
            });
        };

        fs.watchFile(activeFile, { interval: 500 }, watcher);
    }

    function scanForLatestFile() {
        const newestFile = findNewestFile(baseDir, extension);
        if (!newestFile) {
            if (!warnedNoFile) {
                warnedNoFile = true;
                console.error(`[Telemetry] No ${logPrefix} session logs found in ${baseDir}`);
            }
            return;
        }

        warnedNoFile = false;
        if (newestFile !== activeFile) {
            attachFile(newestFile);
        }
    }

    scanForLatestFile();
    setInterval(scanForLatestFile, 3000);
}

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

                if (!row.data) continue;
                try {
                    const parsed = JSON.parse(row.data);
                    const formattedLog = {
                        timestamp: new Date((parsed.time && parsed.time.start) || row.time_created || Date.now()).toISOString(),
                        type: parsed.type || 'unknown_event',
                        payload: parsed,
                    };
                    sendLog(JSON.stringify(formattedLog));
                } catch (e) {
                    sendLog(row.data.trim().replace(/\r?\n/g, ' '));
                }
            }

            db.close();
        } catch (e) {
            if (db) {
                try { db.close(); } catch (closeErr) { }
            }
        }
    }, 500);
}

sendLog(JSON.stringify({ type: 'connect', payload: { pid: process.pid, agent: agentType, client: clientId, roomId } }), 'system');

// Use prefix matching since MCP passes canonical IDs like 'codex-a5f2', 'claude-b3c1', etc.
const agentFamily = agentType.split('-')[0].toLowerCase();

if (agentFamily === 'codex') {
    const dir = path.join(os.homedir(), '.codex', 'sessions');
    startFileTailer(dir, '.jsonl', 'Codex');
} else if (agentFamily === 'claude') {
    const dir = path.join(os.homedir(), '.claude');
    startFileTailer(dir, '.jsonl', 'Claude Code');
} else if (agentFamily === 'opencode') {
    startOpenCodeTailing();
} else {
    console.log(`[Telemetry] Agent family '${agentFamily}' (from '${agentType}'), standing by for stdin...`);
}

process.stdin.on('data', (data) => {
    const text = data.toString().trim();
    if (text) {
        sendLog(text);
    }
});

