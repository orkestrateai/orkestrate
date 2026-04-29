<picture>
  <source media="(prefers-color-scheme: dark)" srcset=".github/logo.svg">
  <img alt="Orkestrate" src=".github/logo.svg" width="48" height="48">
</picture>

# Orkestrate

**Your AI companion that remembers every conversation and learns who you are.**

Orkestrate is a privacy-conscious desktop AI assistant powered by AWS Bedrock. It combines a native Tauri desktop application with a lightweight web authentication layer, delivering fast, secure, stateful AI conversations without your data leaving your machine.

---

## Features

- **Persistent Memory** — Every conversation is saved. Sessions persist across restarts. Orkestrate remembers context, preferences, and your history — so you never start from scratch.
- **Cloud Inference, Zero Setup** — AI runs on AWS Bedrock (MiniMax M2.5) with no local model downloads, GPU requirements, or complex configuration. Sign in and start talking.
- **Google OAuth** — One-click Google sign-in via Supabase. Tokens auto-refresh. No passwords to manage.
- **Deep Link Auth** — Sign in from your browser and the desktop app connects instantly via the `orkestrate://` protocol. No localhost redirect gymnastics.
- **Streaming Responses** — Real-time token-by-token streaming. See the AI think as it responds.
- **Auto-Update** — Ships with a production auto-updater via GitHub Releases. You always have the latest version.
- **Session Management** — Title generation, session history, search. Jump between conversations seamlessly.
- **Dark by Default** — A refined, minimal dark UI built with Tailwind v4 and Base UI. No light mode, no distractions.
- **Crash-Safe** — Every crash writes a diagnostic dump to your app data directory. No silent failures.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Desktop (Tauri 2)                        │
│  ┌──────────┐    ┌──────────────┐    ┌──────────────────────┐  │
│  │ React UI │◄──►│  Axum Proxy  │◄──►│   Rust Auth Module  │  │
│  │ (Vite)   │    │ :3001        │    │   session.json      │  │
│  └──────────┘    └──────┬───────┘    └──────────────────────┘  │
│                         │ HTTPS                                 │
└─────────────────────────┼───────────────────────────────────────┘
                          │
┌─────────────────────────┼───────────────────────────────────────┐
│              Website (Next.js on Vercel)                        │
│  ┌──────────────┐      ┌──────────────────┐                   │
│  │  Landing     │      │   API Routes     │                   │
│  │  + Login     │      │  /api/chat       │                   │
│  └──────┬───────┘      │  /api/auth/me    │                   │
│         │              │  /auth/callback   │                   │
│         ▼              └────────┬─────────┘                   │
│  ┌─────────────┐               │                               │
│  │  Supabase   │               │                               │
│  │  Auth       │               ▼                               │
│  └─────────────┘    ┌────────────────────┐                    │
│                     │  AWS Bedrock       │                    │
│                     │  (MiniMax M2.5)    │                    │
│                     └────────────────────┘                    │
└──────────────────────────────────────────────────────────────┘
```

### Components

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Desktop App** | Tauri 2 + Rust + React + Vite | Native window, IPC, system integration |
| **Chat Proxy** | Axum (embedded in Tauri) | Forwards requests to cloud with JWT attached |
| **Auth** | Supabase + Google OAuth | JWT-based authentication with auto-refresh |
| **Inference** | AWS Bedrock (mantle endpoint) | MiniMax M2.5 via OpenAI-compatible API |
| **Website** | Next.js 16 + Tailwind v4 | Landing page, login, auth callback hosting |
| **Packaging** | NSIS / MSI installer | Per-user install, auto-updater artifacts |

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) 1.3+
- [Rust](https://rustup.rs) 1.80+
- An AWS account with Bedrock access (MiniMax M2.5 enabled)

### Clone & Install

```bash
git clone https://github.com/system1970/Orkestrate.git
cd Orkestrate

# Install website dependencies
cd website && bun install && cd ..

# Install desktop dependencies
cd desktop && bun install && cd ..
```

### Run in Development

```bash
# Terminal 1: Start the website
cd website && bun run dev

# Terminal 2: Start the desktop app
cd desktop && bun run tauri dev
```

### Environment Variables

Copy `website/.env.example` to `website/.env` and configure:

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anonymous key |
| `AWS_BEARER_TOKEN_BEDROCK` | Yes | Bedrock API key (long-term) |
| `AWS_REGION` | No | Default: `us-east-1` |
| `BEDROCK_MODEL_ID` | No | Default: `minimax.minimax-m2.5` |

### Build for Production

```bash
cd desktop
set TAURI_SIGNING_PRIVATE_KEY=<your-private-key>
set TAURI_SIGNING_PRIVATE_KEY_PASSWORD=<your-password>
bun run tauri build
```

Output installers are in `src-tauri/target/release/bundle/`.

## Security

- **No keys in the binary** — AWS credentials live only in Vercel's encrypted environment variables. Supabase anon key is public by design.
- **All inference is server-side** — The desktop app never calls Bedrock directly. Every request goes through `orkestrate.space/api/chat` with JWT validation.
- **Tokens are local** — Auth tokens persist in `session.json` inside your OS app data directory. No telemetry, no external token forwarding.
- **CSP-locked** — Content Security Policy allows connections only to `orkestrate.space` and localhost. No remote scripts, no injected content.
- **Single-instance enforcement** — Only one app instance runs at a time. No conflicts, no duplicated state.
- **Crash dumps stay local** — Panic information writes to your local app data. Nothing is sent externally.

## Development

### Repository Structure

```
Orkestrate/
├── website/                  # Next.js 16 (landing + auth + chat API)
│   ├── src/app/page.tsx      # Landing page
│   ├── src/app/login/        # Google OAuth login
│   ├── src/app/auth/         # OAuth callback handler
│   └── src/app/api/chat/     # Bedrock inference proxy
├── desktop/                  # Tauri 2 desktop app
│   ├── src/                  # React frontend (Vite)
│   │   ├── components/       # UI components
│   │   ├── hooks/            # useChat hook with auth
│   │   └── stores/           # Session store
│   └── src-tauri/            # Rust backend
│       ├── src/ai/           # Auth, chat handler, memory
│       └── tauri.conf.json   # App config, CSP, updater
├── .github/
│   └── workflows/            # Release build pipeline
└── vercel.json               # Root directory config for Vercel
```

### Key Commands

| Command | Directory | Action |
|---------|-----------|--------|
| `bun run dev` | `website/` | Start Next.js dev server on :3000 |
| `bun run tauri dev` | `desktop/` | Start desktop app in dev mode |
| `bun run build` | `website/` | Production build of the website |
| `bun run tauri build` | `desktop/` | Build desktop installer (MSI + NSIS) |
| `cargo check` | `desktop/src-tauri/` | Type-check Rust code |

### Deployment

The website is auto-deployed to **Vercel** on pushes to `main`. Add `[vercel skip]` to the HEAD commit message to skip deployment.

Desktop releases are built via **GitHub Actions** by pushing a version tag:

```bash
git tag v0.1.1
git push origin v0.1.1
```

## Tech Stack

| Category | Choice |
|----------|--------|
| **Desktop Framework** | [Tauri 2](https://v2.tauri.app) |
| **Frontend** | React 19, Vite 7, Tailwind v4, Base UI |
| **Backend** | Rust, Axum, Tokio |
| **AI SDK** | [Vercel AI SDK](https://ai-sdk.dev) v6 |
| **AI Provider** | AWS Bedrock (MiniMax M2.5 via mantle) |
| **Auth** | Supabase + Google OAuth |
| **Website** | Next.js 16, Turbopack |
| **Streaming** | Server-Sent Events via UI Message Stream |
| **Installer** | NSIS + MSI (Windows) |
| **CI/CD** | GitHub Actions + Vercel Git Deploy |

## License

Private — all rights reserved.

---

<p align="center">
  <sub>Built with Rust, React, and too much coffee.</sub>
</p>
