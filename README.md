# Orkestrate

Browse, use, and share **specialized harnesses** for **agent packs** — task-tuned execution for specialized agents.

- **CLI + workbench:** [`orkestrate/`](orkestrate/) (Bun, OpenTUI)
- **Website + registry:** [`website/`](website/) → [orkestrate.space](https://orkestrate.space)
- **Product notes:** [`orkestrate-design.md`](orkestrate-design.md)

## Install

**macOS / Linux**

```sh
curl -fsSL https://orkestrate.space/cli/install.sh | bash
```

**Windows (PowerShell)**

```powershell
irm https://orkestrate.space/cli/install.ps1 | iex
```

Requires [Bun](https://bun.sh) 1.3+. Then:

```sh
orkestrate doctor
orkestrate registry install coding
orkestrate
```

Manual install: `npm install -g orkestrate` or `bun install -g orkestrate`.

## Development

```sh
cd orkestrate
bun install
bun run check
bun run dev
```

Website:

```sh
cd website
bun install
bun run dev
```

Copy `website/.env.example` → `website/.env.local` and add Supabase keys for registry/submit locally. **Never commit env files.**

## Repository layout

| Path | Description |
|------|-------------|
| `orkestrate/` | Shippable npm package (`orkestrate` on npm) |
| `orkestrate/packs/` | Bundled agent packs (`coding`, `extension-builder`) |
| `orkestrate/extensions/` | Harness drivers (OpenCode adapter) |
| `website/` | Next.js marketing site, docs, registry API |
| `website/supabase/migrations/` | Postgres schema for registry |

## Docs

- [orkestrate.space/docs](https://orkestrate.space/docs)
- [llms.txt](https://orkestrate.space/llms.txt) · [agents.md](https://orkestrate.space/agents.md)

## Source

[github.com/orkestrateai/orkestrate](https://github.com/orkestrateai/orkestrate)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Security: [SECURITY.md](SECURITY.md).

## License

MIT — see [LICENSE](LICENSE).