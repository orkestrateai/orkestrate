# Debugging Principles

## 1. Always Surface Errors

Never swallow errors silently. Every catch block must log.

```typescript
// ❌ WRONG — error disappears
try {
  const update = await check();
} catch {
  setUpdateStatus('Failed.');
}

// ✅ RIGHT — error is visible
try {
  const update = await check();
} catch (e) {
  console.error('[updater]', e);
  setUpdateStatus(`Failed: ${e}`);
}
```

**Check all output sources:**
- Terminal (Rust logs, `println!`, `eprintln!`, port bind failures)
- DevTools Console (F12 in Tauri window — CSP violations, JS errors)
- Network tab (blocked requests, redirect URLs, CDN domains)

## 2. Test Locally Before Deploying

Dev mode (`bun run tauri dev`) catches 90% of issues without waiting for CI.

### Testing the Updater Locally

```powershell
# Terminal 1: Serve latest.json
cd desktop
python -m http.server 8000

# Terminal 2: Run app in dev mode
cd desktop
bun run tauri dev
```

Point the updater endpoint at localhost in `tauri.conf.json`:
```json
"endpoints": [
  "http://127.0.0.1:8000/latest.json",
  "https://github.com/system1970/Orkestrate/releases/latest/download/latest.json"
]
```

The updater tries the first endpoint. If localhost works but GitHub fails, the issue is with the remote endpoint (not permissions or logic).

### Testing Other Integrations Locally

- **Memory system**: Axum server on `127.0.0.1:3001`. Test with `curl` directly.
- **Auth flow**: Use `bun run tauri dev`, check AppData for `session.json`.
- **Global shortcuts**: Press the shortcut and check terminal for plugin errors.

## 3. Tauri-Specific Debugging

### Permissions (Silent Failures)

Tauri plugins fail SILENTLY when permissions are missing. Always check `capabilities/default.json`:

```json
{
  "permissions": [
    "core:default",
    "updater:default",      // Required for @tauri-apps/plugin-updater
    "opener:default",       // Required for revealItemInDir
    "core:window:allow-*",  // Required for window.show() / hide() / setFocus()
  ]
}
```

If a Tauri command silently does nothing:
1. Check `capabilities/default.json` for the required `allow-*` permission
2. Each plugin has its own permission namespace (e.g., `updater:default`, `global-shortcut:default`)
3. `core:default` does NOT include plugin permissions

### CSP Blocks (Visible in DevTools)

CSP violations appear in the **DevTools Console** as red errors. Common fixes:

| Error | Fix |
|---|---|
| `connect-src` blocks GitHub | Add `https://github.com https://*.github.com https://githubusercontent.com` |
| `connect-src` blocks CDN redirect | Release downloads redirect to `objects.githubusercontent.com` — add it |
| `img-src` blocks images | Add `https:` |
| IPC fails silently | Must include `ipc: http://ipc.localhost` |

**Important**: The Tauri updater plugin uses Rust's HTTP client (reqwest), NOT the webview. CSP rules do NOT apply to Rust-side HTTP requests. If the updater fails and there's no CSP error in DevTools, the issue is permissions or network.

### Rust Crashes (Port Conflicts)

```powershell
# Check if port is already in use
netstat -ano | findstr ":3001"

# Kill the process
Stop-Process -Id <PID> -Force
```

The Axum server binds `127.0.0.1:3001`. If a previous instance is still running, the new one crashes with exit code 255.

### WebView DevTools

Open DevTools in a Tauri window (F12 or right-click → Inspect). Check:
- **Console** — JS errors, CSP violations
- **Network** — failed requests, redirect chains
- **Application** — localStorage (theme, auth state)

## 4. Release Checklist

Before tagging a release:

- [ ] `version` in `tauri.conf.json` matches the Git tag version
- [ ] `createUpdaterArtifacts: true` in `tauri.conf.json`
- [ ] `pubkey` in `tauri.conf.json` matches the private key in GitHub Secrets
- [ ] `updater:default` in `capabilities/default.json`
- [ ] All plugin permissions present (`global-shortcut:default`, etc.)
- [ ] Test updater locally with `python -m http.server 8000`
- [ ] CSP allows all required domains (check DevTools Console in dev mode)
- [ ] Frontend builds: `bun run build` passes `tsc`
- [ ] Rust builds: `cargo check` passes

## 5. Common Pitfalls

### tauri-action Input Names

The GitHub Action input names differ from what some docs show:

| Wrong | Correct |
|---|---|
| `uploadUpdaterJson` | `includeUpdaterJson` |
| `releaseAssetNamePattern` | `assetNamePattern` |
| `tauri-action@v1` | `tauri-action@v0` (v1 tag does not exist) |

### Updater Does NOT Use WebView CSP

The updater plugin makes HTTP requests from Rust, not JavaScript. CSP rules have no effect on it. If the updater fails:
1. Check `updater:default` in capabilities
2. Check the endpoint URL is reachable (`curl` it)
3. Check signature verification (pubkey matches private key)

### Stale Processes

Windows: The `.exe` may keep running after closing. Check Task Manager for `orkestrate.exe`. Kill it before rebuilding.

### Port 3001

The Axum server always uses `127.0.0.1:3001`. Only one instance can bind. If `bun run tauri dev` crashes with exit code 255, kill the old process first.

### Version Numbers

- Git tag: `v0.2.6` (for triggering CI)
- `tauri.conf.json` version: `0.2.6` (what the app reports and updater compares)
- Installer name: `orkestrate_0.2.6_x64-setup.exe` (auto-generated from version)
- Keep these in sync. The tag and version must match.

## 6. Debug Flow

```
Something fails
      │
      ▼
Is there an error message?
  ├─ YES → Read it. Fix it.
  └─ NO  → Surface the error. Add console.error/logging.
              │
              ▼
         Is it a Tauri command/plugin?
           ├─ YES → Check capabilities/default.json permissions
           └─ NO  → Check DevTools Console for CSP/JS errors
                       │
                       ▼
                  Is it a network request?
                    ├─ YES → curl the URL. Check it returns 200.
                    │        If it redirects, check all redirect domains in CSP.
                    └─ NO  → Check terminal for Rust panics/port conflicts.
```

## 7. Quick Reference

| Symptom | Likely Cause | Fix |
|---|---|---|
| "not allowed" in error | Missing permission | Add to `capabilities/default.json` |
| Exit code 255 on startup | Port 3001 in use | `netstat -ano \| findstr ":3001"` → kill PID |
| CSP error in DevTools | Domain not in `connect-src` | Add domain to CSP |
| Updater "Failed" silently | Missing `updater:default` | Add to capabilities |
| CI can't find `latest.json` | File in subdirectory | Check `bundle/nsis/` or `bundle/msi/` |
| Release 404 | CDN propagation delay | Wait 2-5 minutes after release creation |
