/**
 * Orkestrate Telemetry — Claude Code JSONL Tailer
 *
 * Launched automatically by the SessionStart hook.
 * Reads the transcript_path from stdin (hook input), then tails the JSONL
 * session log to stream ALL events to the Orkestrate dashboard.
 *
 * Requires: ORKESTRATE_INGEST_URL env var
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { execFileSync } = require('child_process');

// --- Config from env (with fallback to ~/.orkestrate/.env) ---
let INGEST_URL = process.env.ORKESTRATE_INGEST_URL || '';
if (!INGEST_URL) {
    try {
        const envFile = path.join(process.env.HOME || process.env.USERPROFILE || '', '.orkestrate', '.env');
        const envContent = fs.readFileSync(envFile, 'utf-8');
        for (const line of envContent.split('\n')) {
            const match = line.match(/^ORKESTRATE_INGEST_URL=(.+)$/);
            if (match) { INGEST_URL = match[1].trim(); break; }
        }
    } catch { }
}
if (!INGEST_URL) {
    console.error('[Telemetry] ORKESTRATE_INGEST_URL not set and ~/.orkestrate/.env not found. Exiting.');
    process.exit(1);
}

const POLL_INTERVAL_MS = 1500;
const HEARTBEAT_INTERVAL_MS = 15_000;

// --- Command line arguments ---
const isStopCommand = process.argv.includes('--stop');

// --- Exclusive instance locking (PID file) ---
function ensureExclusive() {
    try {
        const url = new URL(INGEST_URL);
        const pidKey = crypto.createHash('sha1').update(`${url.hostname}:${url.port}`).digest('hex').slice(0, 12);
        const pidDir = path.join(os.tmpdir(), 'orkestrate');
        const pidFile = path.join(pidDir, `telemetry-claude-${pidKey}.pid`);

        if (!fs.existsSync(pidDir)) fs.mkdirSync(pidDir, { recursive: true });

        if (fs.existsSync(pidFile)) {
            const oldPid = parseInt(fs.readFileSync(pidFile, 'utf-8').trim(), 10);
            if (!isNaN(oldPid)) {
                try {
                    process.kill(oldPid, 0); // Check if alive
                    if (isStopCommand) console.log(`[Telemetry] Stopping process ${oldPid}...`);
                    process.kill(oldPid, 'SIGTERM');
                } catch (e) { }
            }
        }

        if (isStopCommand) {
            try { if (fs.existsSync(pidFile)) fs.unlinkSync(pidFile); } catch (e) { }
            process.exit(0);
        }

        fs.writeFileSync(pidFile, String(process.pid));
        process.on('exit', () => { try { fs.unlinkSync(pidFile); } catch (e) { } });
    } catch (e) {
        if (isStopCommand) process.exit(0);
    }
}

const crypto = require('crypto');
const os = require('os');
ensureExclusive();

// --- HTTP posting ---
function postToIngest(payload) {
    try {
        const url = new URL(INGEST_URL);
        const mod = url.protocol === 'https:' ? https : http;
        const body = JSON.stringify(payload);

        const req = mod.request(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body),
            },
        }, (res) => {
            res.resume();
            if (res.statusCode >= 400) {
                console.error(`[Telemetry] POST failed: ${res.statusCode}`);
            }
        });

        req.on('error', (err) => {
            console.error(`[Telemetry] POST error: ${err.message}`);
        });
        req.write(body);
        req.end();
    } catch (e) {
        console.error(`[Telemetry] POST exception: ${e.message}`);
    }
}

// --- Find latest Claude transcript ---
function findLatestTranscript() {
    const home = process.env.HOME || process.env.USERPROFILE || '';
    const claudeDir = path.join(home, '.claude', 'projects');
    if (!fs.existsSync(claudeDir)) return '';

    let newest = { path: '', mtime: 0 };
    function walk(dir) {
        try {
            for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                const full = path.join(dir, entry.name);
                if (entry.isDirectory()) walk(full);
                else if (entry.name.endsWith('.jsonl')) {
                    try {
                        const stat = fs.statSync(full);
                        if (stat.mtimeMs > newest.mtime) {
                            newest = { path: full, mtime: stat.mtimeMs };
                        }
                    } catch { }
                }
            }
        } catch { }
    }
    walk(claudeDir);
    return newest.path;
}

// --- Read hook input from stdin to get transcript_path ---
let stdinData = '';
let started = false;

process.stdin.setEncoding('utf-8');
process.stdin.on('data', (chunk) => { stdinData += chunk; });
process.stdin.on('end', () => {
    if (started) return;
    started = true;

    let transcriptPath = '';
    try {
        const hookInput = JSON.parse(stdinData);
        transcriptPath = hookInput.transcript_path || '';
    } catch { }

    if (!transcriptPath) transcriptPath = findLatestTranscript();
    boot(transcriptPath);
});

// Fallback: if stdin doesn't close within 2s, proceed without it
setTimeout(() => {
    if (started) return;
    started = true;
    process.stdin.destroy();
    boot(findLatestTranscript());
}, 2000);

// --- Main boot ---
function boot(transcriptPath) {
    if (!transcriptPath || !fs.existsSync(transcriptPath)) {
        console.error('[Telemetry] No transcript found. Exiting.');
        process.exit(1);
    }

    console.log(`[Telemetry] Tailing: ${transcriptPath}`);
    console.log(`[Telemetry] Posting to: ${INGEST_URL}`);
    console.log(`[Telemetry] PID: ${process.pid}`);

    // Track file position and partial lines
    let fileSize = 0;
    let lineBuffer = '';

    // Step 1: Backfill — read last ~200 lines to catch up the dashboard
    try {
        const stats = fs.statSync(transcriptPath);
        const start = Math.max(0, stats.size - (1024 * 1024)); // Read last 1MB
        const fd = fs.openSync(transcriptPath, 'r');
        const buf = Buffer.alloc(stats.size - start);
        fs.readSync(fd, buf, 0, buf.length, start);
        fs.closeSync(fd);

        const text = buf.toString('utf-8');
        const lines = text.split('\n');
        // Skim for the last 200 lines
        const recent = lines.slice(-200);
        for (const line of recent) {
            const trimmed = line.trim();
            if (trimmed) processLine(trimmed, true); // true = silent/backfill
        }
        fileSize = stats.size;
    } catch (e) {
        console.error(`[Telemetry] Backfill error: ${e.message}`);
    }

    // Step 2: Push initial state
    postToIngest({ type: 'connect', hook_event_name: 'TelemetryConnect', transcript_path: transcriptPath, pid: process.pid });
    postToIngest({ type: 'heartbeat', hook_event_name: 'Heartbeat' });

    // Step 3: Start polling for new content
    const pollTimer = setInterval(() => {
        try {
            const stat = fs.statSync(transcriptPath);
            if (stat.size <= fileSize) return;

            const fd = fs.openSync(transcriptPath, 'r');
            const newBytes = stat.size - fileSize;
            const buf = Buffer.alloc(newBytes);
            fs.readSync(fd, buf, 0, newBytes, fileSize);
            fs.closeSync(fd);

            fileSize = stat.size;

            const text = lineBuffer + buf.toString('utf-8');
            const lines = text.split('\n');
            lineBuffer = lines.pop(); // Keep last potentially incomplete line

            for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed) processLine(trimmed);
            }
        } catch (e) { }
    }, POLL_INTERVAL_MS);

    // Heartbeat every 15s
    const heartbeatTimer = setInterval(() => {
        postToIngest({ type: 'heartbeat', hook_event_name: 'Heartbeat' });
    }, HEARTBEAT_INTERVAL_MS);

    // Graceful shutdown
    let exiting = false;
    function cleanup() {
        if (exiting) return;
        exiting = true;
        clearInterval(pollTimer);
        clearInterval(heartbeatTimer);
        postToIngest({ type: 'disconnect', hook_event_name: 'TelemetryDisconnect' });
        setTimeout(() => process.exit(0), 500);
    }

    process.on('SIGTERM', cleanup);
    process.on('SIGINT', cleanup);
}

function normalizeRemote(raw) {
    if (typeof raw !== 'string' || !raw.trim()) return undefined;
    const value = raw.trim();
    const scp = value.match(/^([^@]+)@([^:]+):(.+)$/);
    if (scp) {
        return `${scp[2].toLowerCase()}/${scp[3].replace(/\.git$/i, "").replace(/^\/+/, "")}`;
    }
    try {
        const parsed = new URL(value);
        return `${parsed.hostname.toLowerCase()}${parsed.pathname.replace(/\.git$/i, "").replace(/\/+$/, "")}`;
    } catch {
        return value.replace(/\.git$/i, '').toLowerCase();
    }
}

function runGit(cwd, args) {
    return execFileSync('git', args, { cwd, stdio: ['ignore', 'pipe', 'ignore'] }).toString('utf-8').trim();
}

function readRepoSnapshot(evt) {
    const cwd = typeof evt?.cwd === 'string' && evt.cwd ? evt.cwd : process.cwd();
    try {
        const remote = runGit(cwd, ['config', '--get', 'remote.origin.url']);
        const branch = runGit(cwd, ['rev-parse', '--abbrev-ref', 'HEAD']);
        const headSha = runGit(cwd, ['rev-parse', 'HEAD']);
        const dirty = runGit(cwd, ['status', '--porcelain', '-uno']).length > 0;
        return {
            canonicalRemote: normalizeRemote(remote),
            branch: branch || (typeof evt?.gitBranch === 'string' ? evt.gitBranch : undefined),
            headSha: headSha || undefined,
            dirty,
        };
    } catch {
        return {
            branch: typeof evt?.gitBranch === 'string' ? evt.gitBranch : undefined,
        };
    }
}

function maybeString(value) {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function inferOperation(toolName) {
    const lower = String(toolName || '').toLowerCase();
    if (lower.includes('delete') || lower.includes('remove')) return 'delete';
    if (lower.includes('move') || lower.includes('rename')) return 'move';
    if (lower.includes('create')) return 'create';
    if (lower.includes('write') || lower.includes('edit') || lower.includes('replace')) return 'update';
    return 'unknown';
}

function extractPath(input) {
    if (!input || typeof input !== 'object') return null;
    return (
        maybeString(input.path) ||
        maybeString(input.file) ||
        maybeString(input.targetFile) ||
        maybeString(input.TargetFile) ||
        maybeString(input.AbsolutePath) ||
        maybeString(input.newPath) ||
        maybeString(input.destination) ||
        null
    );
}

function extractLine(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function patchHash(input) {
    return crypto.createHash('sha1').update(JSON.stringify(input || {})).digest('hex').slice(0, 16);
}

function emitActivity(activity) {
    postToIngest({
        event: 'activity',
        ...activity,
    });
}

function emitActivitiesForEvent(evt) {
    const repo = readRepoSnapshot(evt);

    if (evt.type === 'system' && evt.subtype === 'local_command' && typeof evt.content === 'string') {
        if (/git\s+commit\b/i.test(evt.content)) {
            let changedPaths = [];
            try {
                const cwd = typeof evt?.cwd === 'string' && evt.cwd ? evt.cwd : process.cwd();
                const lines = runGit(cwd, ['diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD']);
                changedPaths = lines.split('\n').map((line) => line.trim()).filter(Boolean).slice(0, 200);
            } catch { }
            emitActivity({
                type: 'commit_observed',
                repo,
                payload: {
                    commit: {
                        sha: repo.headSha || '',
                        message: 'git commit',
                        changedPaths,
                    },
                },
            });
        }
        return;
    }

    const content = Array.isArray(evt?.message?.content) ? evt.message.content : [];
    for (const part of content) {
        if (!part || typeof part !== 'object') continue;
        if (part.type !== 'tool_use') continue;
        const toolName = part.name || 'tool';
        const op = inferOperation(toolName);
        if (op === 'unknown') continue;
        const toolInput = part.input && typeof part.input === 'object' ? part.input : {};
        const filePath = extractPath(toolInput);
        if (!filePath) continue;

        const lineStart = extractLine(toolInput.lineStart ?? toolInput.startLine ?? toolInput.line);
        const lineEnd = extractLine(toolInput.lineEnd ?? toolInput.endLine);
        const snippet = typeof toolInput.content === 'string' ? toolInput.content.slice(0, 300) : undefined;

        emitActivity({
            type: 'file_edit_observed',
            repo,
            payload: {
                edit: {
                    path: filePath,
                    operation: op,
                    lineStart,
                    lineEnd,
                    snippet,
                    patchHash: patchHash({ toolName, filePath, op, lineStart, lineEnd, snippet }),
                },
            },
        });
    }
}

// --- Process a JSONL line ---
function processLine(text, isBackfill = false) {
    try {
        const evt = JSON.parse(text);

        // Skip noise
        if (evt.type === 'file-history-snapshot' || evt.type === 'turn_context' || evt.isMeta === true) return;

        postToIngest({
            type: evt.type || 'unknown',
            hook_event_name: 'TranscriptEvent',
            isBackfill,
            sessionId: evt.sessionId,
            uuid: evt.uuid,
            message: evt.message,
            content: evt.content,
            subtype: evt.subtype,
            timestamp: evt.timestamp || new Date().toISOString()
        });

        if (!isBackfill) {
            emitActivitiesForEvent(evt);
        }

        if (!isBackfill) console.log(`[Telemetry] Forwarded: ${evt.type}${evt.subtype ? '/' + evt.subtype : ''}`);
    } catch { }
}
