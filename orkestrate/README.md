# Orkestrate

Browse, use, and share **specialized harnesses** for **agent packs**. Install packs from the registry, launch OpenCode in a new terminal with an isolated pack home — your personal OpenCode config stays untouched.

```text
pack = pack.yaml + harnesses/opencode/
launch = new terminal + .orkestrate/pack-homes/<packId>/
```

## Install

**macOS / Linux**

```sh
curl -fsSL https://orkestrate.space/cli/install.sh | bash
```

**Windows (PowerShell)**

```powershell
irm https://orkestrate.space/cli/install.ps1 | iex
```

Installs [Bun](https://bun.sh) if needed, then `orkestrate` globally. If Bun is already on PATH:

```sh
npm install -g orkestrate
# or: bun install -g orkestrate
```

```sh
orkestrate doctor
orkestrate registry install coding
orkestrate
```

## Commands

| Command | Purpose |
|---------|---------|
| `orkestrate` | OpenTUI workbench |
| `orkestrate pack list\|install\|create\|validate` | Packs |
| `orkestrate run launch <id>` | New terminal → OpenCode |
| `orkestrate registry list\|search\|install` | Catalog |
| `orkestrate doctor` | Harness health |

## For coding agents

- Machine index: [llms.txt](https://orkestrate.space/llms.txt)
- Instructions: [AGENTS.md](./AGENTS.md) (also at https://orkestrate.space/agents.md)

## Publish to npm

From this directory, with `NPM_TOKEN` or `npm login`:

```sh
bun run check
npm publish --access public
```

CI: tag `orkestrate-v*` or run the **Publish npm** workflow (set repo secret `NPM_TOKEN`).

## Development

```sh
bun install
bun run dev
bun run check
```

Docs: [pack-authoring](docs/pack-authoring.md), [getting-started](docs/getting-started.md).

MIT — see [LICENSE](LICENSE).