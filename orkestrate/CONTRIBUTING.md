# Contributing

Orkestrate is early. Keep contributions small and aligned with the OpenCode-first
profile workbench.

Roadmap: [../plan.md](../plan.md) (work phase-by-phase with maintainers).

## Setup

From this directory (`orkestrate/`):

```sh
bun install
bun run check
```

Use Bun only unless a maintainer explicitly approves another package manager.

## Product boundary

```text
specialized agent = profile + harness adapter + extensions
```

- OpenCode is the only supported harness today.
- Profiles are the main user-facing primitive.
- Extensions can register adapters; marketplace flows are partial.
- Do not add fake harness support or undocumented CLI commands.

## Pull requests

- Keep changes focused.
- Update docs when behavior changes.
- Run `bun run typecheck`.
- Do not commit `.orkestrate/`, `node_modules/`, `.env*`, or local session artifacts.