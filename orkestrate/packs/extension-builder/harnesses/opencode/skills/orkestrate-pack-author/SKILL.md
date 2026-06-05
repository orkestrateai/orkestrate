---
name: orkestrate-pack-author
description: >
  Author Orkestrate packs — pack.yaml, harnesses/opencode native config, skills,
  plugins, validate and install. Use when creating or editing agent packs for
  Orkestrate, scaffolding pack layout, or preparing GitHub/registry publish.
  For launching runs use orkestrate skill instead.
compatibility: opencode
metadata:
  platform: orkestrate
---

# Orkestrate pack author

## Pack layout

```text
my-pack/
  pack.yaml
  harnesses/
    opencode/
      opencode.json
      agents/<agent>.md
      skills/<skill-name>/SKILL.md
      plugins/
  scaffold/
```

## pack.yaml (required fields)

- `id` — lowercase slug (matches folder name)
- `name`, `description`, `harness` (e.g. `opencode`)
- `version` optional

## Harness slice (A)

All OpenCode behavior lives in **`harnesses/opencode/`**:

- `opencode.json` — permissions, agents, MCP, plugins
- `agents/*.md` — agent prompts (frontmatter + body)
- `skills/*/SKILL.md` — OpenCode skills with YAML frontmatter (`name`, `description`)

No Orkestrate tool DSL — native OpenCode config only.

## Workflow

1. Create directory under workspace or copy a seed pack
2. Edit `pack.yaml` and `harnesses/opencode/*`
3. `orkestrate pack validate <id>`
4. `orkestrate pack install <id>` if needed locally
5. `orkestrate run launch <id>` to test (new terminal)

## Orchestrator packs

Include skills `orkestrate` and `orkestrate-pack-author` in `permission.skill` in `opencode.json`.

## Publish

Push to public GitHub; registry stores index + `source_url` + ref + `pack_path` (later phase).