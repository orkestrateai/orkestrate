---
name: orkestrate
description: >
  Orkestrate control room — list/install packs, launch runs in new terminals,
  check and stop runs. Use when orchestrating multiple packs, spawning another
  agent in a separate terminal, or managing concurrent harness runs. Do not use
  for in-session subtasks (use OpenCode task). For authoring packs load
  orkestrate-pack-author.
compatibility: opencode
metadata:
  platform: orkestrate
---

# Orkestrate (runtime)

## When to use

- Launch another installed pack in a **new terminal**
- Run multiple packs or multiple instances of the same pack
- List or stop Orkestrate runs

## When not to use

- Same-session subtasks → OpenCode **`task`** tool
- Authoring pack files → load skill **`orkestrate-pack-author`**

## Commands (run via bash in workspace cwd)

```bash
orkestrate pack list
orkestrate pack install <slug>
orkestrate pack validate <pack-id>

orkestrate run launch <pack-id>
orkestrate run list
orkestrate run status <run-id>
orkestrate run stop <run-id>
```

`run launch` and `run spawn` are the same: **new visible terminal**, prints `runId`.

## Spawn workflow

1. Ensure pack is installed: `orkestrate pack list`
2. `orkestrate run launch <pack-id>`
3. Note the `runId` from output
4. `orkestrate run status <run-id>` to check state
5. `orkestrate run stop <run-id>` if needed

Each launch creates a new run with isolated config under `.orkestrate/runs/<runId>/`.

## Multi-instance

You may launch the same `pack-id` multiple times; each gets a unique `runId`.