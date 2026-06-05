# Orkestrate Website

Production site: https://orkestrate.space

## Stack

- Next.js App Router (`website/`)
- Bun
- Supabase (registry, `/submit` GitHub OAuth)
- Vercel deploy

## Commands

```sh
bun install
bun run lint
bun run build
bun run dev
```

## Env (Vercel production)

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `WAITLIST_FORM_SECRET` (if waitlist API enabled)

GitHub OAuth is configured in **Supabase Dashboard**, not `GITHUB_CLIENT_*` in this app.

## Deploy

Linked project: `orkestrate` (see `.vercel/project.json`). Production: `vercel deploy --prod` from `website/`.