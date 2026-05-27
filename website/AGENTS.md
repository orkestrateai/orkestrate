# Orky Website Agent Guide

## Product

This directory contains the production Orky website deployed at:

- `https://orkestrate.space`

Orky keeps agents honest. The product is about keeping a running agent aligned
with the declared goal instead of letting it drift, obey poisoned context, or
take actions that no longer match what the user wanted.

The current website is intentionally minimal:

- Orky logo
- two-line positioning statement
- waitlist form
- static share image

This simplicity is intentional. Do not add pages, dependencies, dashboards,
auth, chat, billing, MCP connectors, assistant UI, or marketing sections unless
explicitly requested.

## Stack

- Next.js App Router
- Bun
- Supabase service-role insert into `public.waitlist`
- Static public assets for Open Graph and Apple icons
- Vercel production deployment

## Commands

Use Bun only.

- `bun install`
- `bun run lint`
- `bun run build`
- `bun audit`
- `bun run dev`
- `vercel deploy --prod -y`

Do not use `npm`, `npx`, `yarn`, or `pnpm` unless explicitly requested.

## Production Checks

Before deploy:

1. `bun run lint`
2. `bun run build`
3. `bun audit`

The production build should only expose:

- `/`
- `/api/waitlist`
- `/sitemap.xml`
- Next.js not-found route

## Environment

Required Vercel env vars:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `WAITLIST_FORM_SECRET`

Never expose `SUPABASE_SERVICE_ROLE_KEY` to client code. Keep `.env` files out
of git and out of Vercel uploads. `.vercelignore` should exclude `.env` and
`.env.*`.

## Waitlist Route

The waitlist route is `src/app/api/waitlist/route.ts`.

Keep these protections in place:

- server-side email validation
- lowercase normalization
- 254-character max email length
- Supabase `upsert` for duplicate emails
- HMAC form token with expiry
- Origin/Referer validation
- honeypot field
- small body-size cap
- per-instance rate limiting
- redirect-based success and error UX

The route should accept only the form shape the page actually sends. Do not
expand the API for speculative clients.

## Public Assets

Keep public assets small and relevant:

- `public/orky.svg`
- `public/og-image.png`
- `public/apple-icon.png`
- `public/robots.txt`

Do not add large unused images or generated art unless it is actually referenced
by the site.

## Metadata

Metadata lives in `src/app/layout.tsx`.
Sitemap lives in `src/app/sitemap.ts`.

If the domain changes, update:

- canonical URL
- Open Graph URL
- sitemap URL
- `robots.txt`

## Code Style

- Keep code direct and small.
- Avoid abstractions unless they remove real complexity.
- Avoid client JavaScript unless required.
- Keep dependencies minimal.
- Prefer deletion over dead code.
- Avoid generic SaaS copy and visual bloat.
- Preserve the clean, minimal page aesthetic.

## Git

- Run `git status --porcelain` before editing and before final response.
- Do not revert unrelated user changes.
- Stage only task-relevant files.
- Do not commit `.env`, `.vercel/`, local caches, screenshots, or scratch files.
- Do not use destructive git commands unless explicitly requested.
- If asked to commit, verify with lint/build/audit first unless told otherwise.
