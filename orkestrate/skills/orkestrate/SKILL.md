---
name: orkestrate
description: >
  Control-room CLI for Orkestrate packs — list, install, create, validate, launch
  OpenCode in new terminals. Use when driving Orkestrate from an agent session.
compatibility: opencode
metadata:
  platform: orkestrate
---

# Orkestrate

## Concepts

- **Pack** — `pack.yaml` + `harnesses/opencode/` (native OpenCode config).
- **Pack home** — `.orkestrate/pack-homes/<id>/home/` (persistent sessions per pack).
- **Run** — launch metadata under `.orkestrate/runs/<id>/`; TUI shows idle/running on each pack.

Orkestrate does not modify the user's normal OpenCode outside spawned launches.

## CLI (from repo with `orkestrate/` package)

```sh
bun run src/cli/index.ts pack list
bun run src/cli/index.ts pack create <id> --from coding
bun run src/cli/index.ts pack validate <id>
bun run src/cli/index.ts pack install <slug>
bun run src/cli/index.ts registry list
bun run src/cli/index.ts registry install <slug>
bun run src/cli/index.ts run launch <id>
bun run dev
```

TUI: `b` browse, `Enter` install/launch, `s` stop active sessions.

## Authoring

Load **orkestrate-pack-author** skill for `pack.yaml` and harness slice layout.

## Out of scope in v1

- Suspend/handoff TUI, embedded PTY, multi-harness adapters beyond OpenCode driver.