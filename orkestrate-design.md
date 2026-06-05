# Orkestrate Design Notes

Product source of truth for this workspace. The shippable package lives in
`orkestrate/`.

## Locked framing (canonical)

**Hero:** Browse, use, and share specialized harnesses.

**Subhead:** Task-tuned execution for specialized agents — built by you or by the
agent.

**Footnote (v0 honesty):** Starting with OpenCode harness slices inside agent
packs.

### Fundamental shift

One harness does not fit all work. Code review, daily coding, and domain
research need different execution envelopes (tools, prompts, skills, policy).

Orkestrate enables **task-specialized harnesses** that users and agents can
craft, select, and run. The **agent** keeps identity; the **harness slice**
changes with the task.

```text
agent pack     = who (identity, expertise, publishable product)
harness slice  = how for this task (runtime config — specialized per job)
orkestrate     = browse · use · share harnesses; bind agents to the right slice
```

Orkestrate does not replace harness engines (OpenCode today). It is the layer
where specialized harnesses are **cataloged, installed, launched, and published**
— and where agents are not held hostage by a single generic runtime config.

### What putting an agent in this environment does

- Gives the agent a **persistent home** per pack (sessions tied to that agent).
- Makes the agent **installable and publishable** (registry + packs), not a
  one-off chat config.
- Lets the agent **use** (and roadmap: **craft**) harness slices matched to the
  task instead of one forever config.

### Terminology

| Use | Avoid in marketing |
|-----|-------------------|
| Pack / agent pack | Profile (legacy internal/registry kind only) |
| Specialized harness / harness slice | “Master harness,” stable metaphor |
| Extension (ecosystem package) | Adapter as a first-class product line |
| Browse · use · share | Operating system, personal Jarvis, OpenCode-only |

### Audience (now)

Technical builders and makers: pack authors, MCP/skill contributors, devs who
install and launch. Registry = distribution; trending/featured when data exists.

## What ships today

- OpenTUI workbench (`bun run dev` in `orkestrate/`)
- Packs: `pack.yaml` + `harnesses/opencode/`; `pack create|validate|install`
- Launch: **new terminal** + `.orkestrate/pack-homes/<packId>/` (sessions persist)
- OpenCode driver (`extensions/opencode-adapter/`)
- Registry: `registry list|search|install`; website `GET /api/registry` + web
  submit
- CLI: `doctor`, `run launch|list|status|stop`, bundled + remote catalog
- Run status on pack rows (idle / running)

## What is not shipped

- Agent-authored harness slices (user-authored slices in packs only)
- Pi / Claude Code / Codex harness engines
- Embedded harness runtime in the TUI
- Multi-agent orchestration UI
- CLI registry POST / device auth (web submit works)
- Install telemetry / “most used MCPs” trending

## Demo direction

Extension-builder pack → author packs and harness slices. Longer term: agent
proposes or generates a task harness for the current job, then launches it.

## Docs map

| Doc | Purpose |
|-----|---------|
| `orkestrate/README.md` | Install, TUI keys, current status |
| `orkestrate/docs/pack-authoring.md` | Pack + harness slice layout |
| `orkestrate/docs/getting-started.md` | Commands that exist today |
| `orkestrate/docs/concepts.md` | Needs sync to pack + harness-slice model |
| `orkestrate/docs/roadmap.md` | Layered delivery plan |
| `orkestrate/docs/hosted-registry.md` | Publishing via website |

## Repo boundary

Active CLI: `orkestrate/`. Website (`website/`) is a separate surface unless
explicitly requested. Local harness sandboxes (`.opencode/`, `.commandcode/`) stay
gitignored.