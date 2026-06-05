# Orkestrate Workspace Agent Guide

## Source of truth

Read `orkestrate-design.md` before product or architecture changes. The shippable
CLI package is `orkestrate/`.

## Active surface

Work in `orkestrate/` unless the user explicitly asks for `website/` or other paths.

```text
pack = pack.yaml + harnesses/opencode/ + driver
```

**v0 harness:** OpenCode only (`extensions/opencode-adapter/`).

**Launch model:** new terminal window; TUI stays open. Pack sessions persist under
`.orkestrate/pack-homes/<packId>/`. Does not modify the user's normal OpenCode.

## Commands (from `orkestrate/`)

```sh
bun install
bun run dev
bun run check
bun run src/cli/index.ts doctor
```

Subcommands: `pack list|install|create|validate`, `run launch|list|status|stop`,
`registry install` (bundled slugs), `extension validate`, `doctor`.

Docs: `orkestrate/docs/pack-authoring.md`, `orkestrate/docs/demo-extension-builder.md`.

## Out of scope unless requested

- `website/`, Supabase migrations (unless requested), scratch logs
- Pi adapter, registry publish API, multi-pack orchestration UI
- Legacy `src/sdk/profiles/` (deprecated; use packs)

## Engineering

- Bun only (no npm/yarn/pnpm unless exception)
- Keep prototype boundaries honest in docs and UI
- Preserve unrelated user changes
- Do not commit `.env`, `node_modules/`, `.orkestrate/`, screenshots

## Git

Check `git status --porcelain` before and after edits. Commit only when the user
asks. Stage explicit paths only.