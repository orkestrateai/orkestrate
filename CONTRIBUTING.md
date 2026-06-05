# Contributing

Thanks for helping build Orkestrate. This monorepo contains the open-source **CLI** and the **orkestrate.space** website.

## Where to work

| Area | Path | Notes |
|------|------|--------|
| CLI + TUI | [`orkestrate/`](orkestrate/) | Primary product; see [`orkestrate/CONTRIBUTING.md`](orkestrate/CONTRIBUTING.md) |
| Website | [`website/`](website/) | Docs, registry UI, API routes — coordinate larger changes |

Product direction: [`orkestrate-design.md`](orkestrate-design.md).

## Prerequisites

- [Bun](https://bun.sh) 1.3+
- OpenCode on PATH (to test pack launch)
- For website/registry locally: Supabase project + env from `website/.env.example`

## CLI quick start

```sh
cd orkestrate
bun install
bun run check
bun run dev
```

## Pull requests

- Focused PRs with a clear description
- Run `bun run check` in `orkestrate/`
- Run `bun run build` in `website/` when touching the site
- Update docs when behavior or CLI commands change
- **Do not commit** `.env`, `.env.local`, `node_modules/`, `.orkestrate/`, `.vercel/`, or local harness dirs (`.opencode/`, etc.)

## Security

Do not open PRs containing API keys, service role tokens, or personal access tokens. Report issues privately per [SECURITY.md](SECURITY.md).