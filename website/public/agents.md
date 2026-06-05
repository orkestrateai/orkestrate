# Orkestrate — agent instructions

Help the user **browse, use, and share specialized harnesses** for **agent packs**.

## What it is

| Term | Meaning |
|------|---------|
| Agent pack | `pack.yaml` + `harnesses/opencode/` — installable agent product |
| Harness slice | Task-specific runtime (tools, prompts, skills) inside the pack |
| Orkestrate | CLI + **OpenTUI workbench** — install packs, launch OpenCode in a **new terminal**, persist sessions in `.orkestrate/pack-homes/<packId>/` |

v0 is **OpenCode only**. Orkestrate does **not** replace OpenCode and does **not** host agent chat in the workbench.

## Runtime

The npm CLI is a **Bun** program (`#!/usr/bin/env bun`). Install script adds Bun if missing.

## Install

```bash
curl -fsSL https://orkestrate.space/cli/install.sh | bash
# Windows: irm https://orkestrate.space/cli/install.ps1 | iex

orkestrate doctor
orkestrate registry install coding
orkestrate              # workbench
orkestrate run launch coding
```

## Workbench (`orkestrate` no args)

- **Not** an embedded agent UI — launcher + catalog only.
- First run with no packs: welcome installs `coding` on Enter.
- **Installed view**: ↑↓, Enter/l launch, s stop sessions, b browse, q quit.
- **Browse view**: Enter install, i/Esc back.
- Launch opens **another terminal** with OpenCode; workbench stays open.

https://orkestrate.space/docs/workbench

## Commands (trust only these)

```text
orkestrate
orkestrate doctor
orkestrate pack list|install|create|validate
orkestrate run launch|list|status|stop <pack-id>
orkestrate registry list|search|install
orkestrate extension validate
```

## Paths

```text
<workspace>/.orkestrate/packs/<id>/
<workspace>/.orkestrate/pack-homes/<id>/home/
```

Bundled packs: `coding`, `extension-builder`. Registry: `https://orkestrate.space/api/registry`.

## Rules

1. Say **pack**, not legacy **profile**.
2. Launch = **new terminal**; sessions live in the pack home.
3. Do not promise Pi/Claude adapters, CLI registry submit, or agent-generated slices (roadmap).
4. Windows launch needs **Windows Terminal** (`wt` on PATH).

## More context

- Index: https://orkestrate.space/llms.txt
- Docs: https://orkestrate.space/docs