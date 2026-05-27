# Orky

Orky keeps agents honest.

The production website is intentionally minimal: logo, two-line positioning,
and a waitlist form. The current focus is proving the product direction with a
small, secure, fast surface before adding more agent functionality.

Production:

- https://orkestrate.space

## Active Code

- `website/` - Next.js App Router website deployed to Vercel.

Everything outside the active website has been archived outside this repo at:

- `C:\Users\pracu\OneDrive\Desktop\2026\Orkestrate Archive\20260528-011334`

## Website

The website contains:

- `/` - minimal Orky waitlist page
- `/api/waitlist` - server-side waitlist submission route
- `/sitemap.xml` - sitemap
- static public assets for logo, Open Graph, Apple icon, and robots.txt

The waitlist route uses:

- server-side email validation
- lowercase normalization
- duplicate-safe Supabase upsert
- HMAC form token
- Origin/Referer validation
- honeypot field
- body-size cap
- per-instance rate limiting
- redirect-based success and error UX

## Commands

Run from `website/`.

```bash
bun install
bun run lint
bun run build
bun audit
```

Development:

```bash
bun run dev
```

Production deploy:

```bash
vercel deploy --prod -y
```

## Environment

Required Vercel environment variables:

```txt
NEXT_PUBLIC_SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
WAITLIST_FORM_SECRET
```

Do not commit `.env` files. Do not upload local `.env` files to Vercel.

## Git

Keep this repo focused on the active website. Do not reintroduce archived
desktop experiments, scratch files, screenshots, or old product plans unless
there is a specific reason.
