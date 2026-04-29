# Orkestrate — Agent Guide

## Project Overview

A desktop AI companion app (Tauri 2 + React) with cloud inference via AWS Bedrock. Auth via Supabase/Google OAuth. Landing/login website hosted on Next.js/Vercel.

Two active directories:

- **`desktop/`** — Tauri 2 desktop app (Rust backend + React/Vite frontend)
- **`website/`** — Next.js 16 app (landing page, login, auth callback, Bedrock chat API)

## Package Manager

Always use **`bun`**. Never npm or yarn.

| Command | Location | Action |
|---------|----------|--------|
| `bun install` | anywhere | Install deps |
| `bun add <pkg>` | anywhere | Add dependency |
| `bun run dev` | `website/` | Start Next.js dev server |
| `bun run tauri dev` | `desktop/` | Start desktop in dev mode |
| `bun run build` | `website/` | Build website |
| `bun run tauri build` | `desktop/` | Build desktop installer |
| `bunx tauri signer generate` | `desktop/src-tauri/` | Generate updater signing keys |
| `bunx vercel deploy --prod` | `website/` | Deploy website to Vercel |

## Key Architecture

### Desktop (`desktop/`)

```
src-tauri/
  src/
    lib.rs          → Tauri entry point, plugins, Axum server, deep link handler
    main.rs         → Crash handler, panics → dump to AppData/crashes/
    ai/
      auth.rs        → Token storage (session.json), Supabase refresh
      handler.rs     → Axum /api/chat handler, proxies to orkestrate.space
      paths.rs       → APP_DATA_DIR OnceCell
      memory/        → ByteRover-derived context tree memory system
        manager.rs   → MemoryManager (search, profile, storage)
        storage.rs   → ContextTreeStorage (file-based)
        session.rs   → SessionWorkingMemory, SESSION_REGISTRY
        service.rs   → ChatMemoryService
src/
  App.tsx              → Auth gate (loading → onboarding → ready)
  components/
    onboarding/OnboardingFlow.tsx → Google sign-in + deep link polling
    chat/ChatLayout.tsx           → Main chat UI + sidebar
    sidebar/UserMenu.tsx          → Profile popover + logout
    sidebar/Sidebar.tsx           → Nav + recent chats + user menu
    ui/                           → Base UI components (dropdown-menu, dialog, button, etc.)
  hooks/use-chat-session.ts → useChat + DefaultChatTransport + auth
  stores/chat-store.tsx     → Session CRUD (zustand-like)
```

### Website (`website/`)

```
src/app/
  page.tsx              → Landing page (shaders, marketing)
  login/page.tsx        → Google OAuth (handles ?desktop=1 flow)
  auth/callback/route.ts → OAuth code → session → redirect (localhost or orkestrate://)
  api/
    chat/route.ts       → POST /api/chat: JWT → Bedrock (via @ai-sdk/openai + mantle)
    auth/me/route.ts    → GET /api/auth/me: JWT → user info
    health/route.ts     → GET /api/health: { ok: true }
  sitemap.ts            → SEO sitemap
```

## Auth Flow (Desktop Deep Link)

1. Desktop opens browser to `https://orkestrate.space/login?desktop=1`
2. User signs in with Google on website
3. Website shows profile + "Open Orkestrate App" button
4. Button triggers `window.location.href = "orkestrate://auth/callback?access_token=xxx&refresh_token=yyy"`
5. Windows delivers URL to the Tauri app (may split at `&` — `process_cli_args` handles this)
6. Rust `process_auth_url()` stores tokens to `session.json` in AppData
7. Frontend polling (`getCurrent()` + `onOpenUrl()` + 500ms interval) detects auth → renders ChatLayout

## Inference Flow

1. Desktop sends POST to `http://127.0.0.1:3001/api/chat`
2. Axum handler attaches `Authorization: Bearer <jwt>` and forwards to `https://orkestrate.space/api/chat`
3. Website validates JWT via Supabase, calls `streamText()` with Bedrock via mantle endpoint
4. Website returns `toUIMessageStreamResponse()` (AI SDK v6 stream protocol)
5. Desktop forwards raw bytes to frontend (no SSE re-wrapping)
6. Frontend `useChat()` via `DefaultChatTransport` parses the stream

## Env Vars

Website `.env`:

```
NEXT_PUBLIC_SUPABASE_URL=https://zydapvkiwfnxppzeydct.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
AWS_BEARER_TOKEN_BEDROCK=ABSK...
AWS_REGION=us-east-1
BEDROCK_MODEL_ID=minimax.minimax-m2.5
```

Desktop `src-tauri/.env` — not needed for cloud mode. Leftover keys (OpenCode, Exa, OpenRouter) are unused.

## Key Gotchas

### Windows CLI arg splitting
`orkestrate://auth/callback?access_token=xxx&refresh_token=yyy` — Windows splits at `&`. The `process_cli_args()` func joins all args with space and finds the URL before whitespace.

### URL parsing for custom schemes
`orkestrate://auth/callback` — `url::Url::parse()` parses `auth` as **hostname**, path is `/callback`. Check `parsed.host_str() == Some("auth") && parsed.path() == "/callback"` — NOT `/auth/callback`.

### CSP must allow IPC
Tauri v2 IPC uses localhost. CSP must include `connect-src 'self' https://orkestrate.space http://127.0.0.1:* ipc: http://ipc.localhost`. Without `http://127.0.0.1:*`, `invoke()` calls hang silently.

### Vercel root directory
Project is at GitHub root but Next.js app is in `website/`. Set Vercel project Settings → Root Directory → `website`. `vercel.json` at root has `{"rootDirectory":"website"}`.

### AI SDK v6 uses `@ai-sdk/openai` with `baseURL` set to Bedrock mantle
```ts
const bedrock = createOpenAI({
  apiKey: process.env.AWS_BEARER_TOKEN_BEDROCK,
  baseURL: `https://bedrock-mantle.${region}.api.aws/v1`,
});
// Use bedrock.chat(MODEL_ID) — .chat() forces Chat Completions API, not Responses
```

`@ai-sdk/amazon-bedrock` caused `Headers.set` TypeError due to multi-line SigV4 signatures leaking on Vercel. The `@ai-sdk/openai` + mantle approach avoids SigV4 entirely.

### `toUIMessageStreamResponse()` for streaming
AI SDK v6 uses `toUIMessageStreamResponse()`, not `toDataStreamResponse()`. `toTextStreamResponse()` exists in types but won't work with `DefaultChatTransport`.

### Build requires signing keys
```powershell
set TAURI_SIGNING_PRIVATE_KEY=<key>
set TAURI_SIGNING_PRIVATE_KEY_PASSWORD=orkestrate-key-2026
bun run tauri build
```

## Deployment

- **Website**: Auto-deploys to Vercel on push to `main`. Add `[vercel skip]` to HEAD commit message to skip.
- **Desktop**: Build + upload to GitHub Releases. Auto-updater reads `latest.json` from release assets.

## Style

- **Frontend**: Tailwind v4, Base UI, geist fonts, dark theme
- **No monospaced fonts** anywhere in UI (per AGENTS.md rule)
- **Rust**: `cargo check` before commit. Dead code warnings in memory/ are suppressed with `#![allow(dead_code)]`

## Useful URLs

- **Website**: https://orkestrate.space
- **GitHub**: https://github.com/system1970/Orkestrate
- **Releases**: https://github.com/system1970/Orkestrate/releases
- **Vercel dashboard**: https://vercel.com/mirai-kites-projects/orkestrate
- **Supabase**: https://supabase.com/dashboard/project/zydapvkiwfnxppzeydct
- **AI SDK Bedrock docs**: https://ai-sdk.dev/providers/ai-sdk-providers/amazon-bedrock
