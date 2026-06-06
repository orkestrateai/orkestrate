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

## Documentation

**Canonical site docs** (orkestrate.space) live in [`website/src/app/docs/`](website/src/app/docs/) — one `page.tsx` per route. They are a work in progress; clearer tutorials, examples, and CLI parity checks are needed. Contributions are welcome.

| What | Path |
|------|------|
| Website docs (public) | [`website/src/app/docs/`](website/src/app/docs/) |
| CLI / pack authoring notes | [`orkestrate/docs/`](orkestrate/docs/) |

When the two disagree, update the **website** page and mention CLI doc drift in the PR if needed.

**Quick edit:** open any doc on the site and use **Edit this page** (links to GitHub). Locally:

```sh
cd website
bun install
bun run build
```

Label docs issues `documentation` on [GitHub](https://github.com/orkestrateai/orkestrate/issues).

## Pull requests

- Focused PRs with a clear description
- Run `bun run check` in `orkestrate/`
- Run `bun run build` in `website/` when touching the site
- Update docs when behavior or CLI commands change
- **Do not commit** `.env`, `.env.local`, `node_modules/`, `.orkestrate/`, `.vercel/`, or local harness dirs (`.opencode/`, etc.)

## Security

Do not open PRs containing API keys, service role tokens, or personal access tokens. Report issues privately per [SECURITY.md](SECURITY.md).