# Orky Agent Guide

## Product Vision

Orky is the layer that keeps agents honest.

The product exists because long-running AI agents drift: they lose the original
goal, obey poisoned context, summarize bad instructions into memory, and take
actions that no longer match what the user wanted. Orky watches the declared
goal, the current subtask, the agent's proposed next action, and outside input.
It should make clear whether the agent is still on task.

The current production site is intentionally small. That is a product decision,
not an unfinished accident. Every file, dependency, public asset, route, and API
surface should justify its existence.

## Active Surface

The production website lives in `website/` and deploys to:

- `https://orkestrate.space`

Current public surface:

- one minimal landing page
- one waitlist form
- one waitlist API route
- static Open Graph and Apple icon assets
- Supabase insert into `public.waitlist`

Do not reintroduce auth, chat, billing, MCP connectors, dashboards, assistant UI,
or marketing sections unless explicitly requested.

## Engineering Principles

- Keep dependencies minimal.
- Prefer deleting unused code over hiding it.
- Keep routes, public assets, and API surfaces small.
- Be security-conscious by default.
- Do not add compatibility layers, legacy shims, or dual old/new flows unless
  explicitly requested.
- Avoid clever abstractions. This is a tiny production site; direct code is
  usually better.
- Validate all external input on the server.
- Never expose service-role secrets or private env vars to client code.
- Keep `.env` files out of Vercel uploads and git.
- Keep the visual design quiet, intentional, and minimal.

## Package Manager

Use Bun only.

- Install dependencies: `bun install`
- Add dependency: `bun add <package>`
- Add dev dependency: `bun add -d <package>`
- Run scripts: `bun run <script>`
- One-off CLIs: `bunx <command>`

Do not use `npm`, `npx`, `yarn`, or `pnpm` unless the user explicitly asks for
an exception.

## Website Commands

Run these from `website/`.

- Lint: `bun run lint`
- Build: `bun run build`
- Audit: `bun audit`
- Dev server: `bun run dev`
- Production deploy: `vercel deploy --prod -y`

Before production deploy, run:

1. `bun run lint`
2. `bun run build`
3. `bun audit`

## Vercel Deployment

The website is linked to the Vercel project `orkestrate`.

Required production environment variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `WAITLIST_FORM_SECRET`

Deployment hygiene:

- `.vercelignore` must exclude `.env`, `.env.*`, local caches, and local tooling.
- Prefer Vercel environment variables over local env files.
- Do not deploy with local secrets bundled into the upload.
- If Vercel warns that a local `.env` file was detected, fix `.vercelignore` and
  redeploy.

## Waitlist System

The waitlist route is `website/src/app/api/waitlist/route.ts`.

Expected protections:

- server-side email validation
- email normalization to lowercase
- max email length of 254
- duplicate handling through Supabase `upsert`
- HMAC-signed form token
- token expiry
- Origin/Referer validation
- hidden honeypot field
- small request body cap
- per-instance rate limiting
- friendly redirect-based UX for success and error states

The Supabase client uses the service-role key only on the server. Never import
server Supabase helpers into client components.

## Metadata And Assets

The share image should be static, not dynamically generated, unless there is a
strong reason to change that.

Current public assets should stay small and intentional:

- `public/orky.svg`
- `public/og-image.png`
- `public/apple-icon.png`
- `public/robots.txt`

Metadata lives in `website/src/app/layout.tsx`.
Sitemap lives in `website/src/app/sitemap.ts`.

If the production domain changes, update:

- metadata canonical URL
- Open Graph URL
- sitemap URL
- `robots.txt` sitemap URL

## Security Baseline

Maintain security headers in `next.config.ts`:

- `Referrer-Policy`
- `X-Content-Type-Options`
- `X-Frame-Options`
- `Permissions-Policy`
- `Strict-Transport-Security`

Run `bun audit` before deploy and address production dependency advisories.
Dev-only advisories should still be handled when practical, especially when a
small override or patch clears them safely.

## Git Rules

- Check `git status --porcelain` before editing and before final response.
- Do not revert or overwrite unrelated user changes.
- Keep commits focused and explain what changed.
- Stage only files relevant to the task.
- Do not commit `.env`, `.vercel/`, local caches, screenshots, or scratch files.
- Do not use destructive git commands such as `git reset --hard` or
  `git checkout --` unless the user explicitly requests them.
- Prefer non-interactive git commands.
- If asked to commit, run lint/build/audit first unless the user explicitly asks
  to skip verification.

## Current Standard

The current site has had deliberate cleanup: old app surfaces were removed,
dependencies were reduced, static share assets were generated, security headers
were added, and the production deploy was verified through Vercel. Preserve that
level of intent. Do not let the repo drift back into generic AI-app bloat.
