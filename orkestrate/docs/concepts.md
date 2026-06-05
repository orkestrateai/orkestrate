# Concepts

Orkestrate is an open workbench for specialized AI agent profiles.

The core loop is simple:

```text
browse profile -> install profile -> inspect requirements -> launch harness
```

## Profile

A profile is a packaged agent identity.

It defines:

- what the agent does;
- which harness it runs on;
- model defaults;
- prompt and operating workflow;
- tools and permissions;
- skills or other context resources;
- harness-specific launch configuration.

Profiles are the user-facing primitive. A user should be able to choose
`math-researcher`, `proof-referee`, `coding`, or `frontend-polisher` without
understanding every config file behind it.

Current profiles are JSON files stored in:

```text
orkestrate/profiles/               bundled seed + catalog templates
~/.orkestrate/profiles/            global installed profiles
<workspace>/.orkestrate/profiles/  workspace installed profiles
```

## Harness

A harness is the runtime that actually runs the agent.

Examples:

- OpenCode
- Claude Code
- Codex
- future domain-specific harnesses

The harness owns the agent loop, terminal UI, tool execution, model calls, and
session behavior. Orkestrate does not replace the harness. It prepares a profile
for the harness and launches it.

## Adapter

An adapter teaches Orkestrate how to launch profiles for one harness.

An adapter can:

- detect whether a harness is installed;
- report version/status;
- translate a profile into harness config;
- prepare environment variables and launch args;
- avoid mutating global harness configuration.

Adapters are not a separate ecosystem category. An adapter is one contribution
type inside an extension.

For the launch build, the OpenCode adapter is built into the package. The
future extension system should let harness makers ship adapter extensions.

## Extension

An extension is an installable package of contributions.

It may contribute:

- profiles;
- harness adapters;
- skills;
- MCP server templates;
- commands;
- permission policies;
- docs and examples.

This is the ecosystem primitive. A profile pack, a Lean skill pack, a Supabase
MCP pack, and an OpenCode adapter are all extensions with different
contributions.

## Skill

A skill is reusable domain or workflow knowledge for an agent.

In the current OpenCode adapter, profile skills are prototype local references:
Orkestrate looks for matching `SKILL.md` files and injects their text into the
profile prompt. Native OpenCode skills are disabled for the generated profile.

That is enough for the launch demo, but not the final portability model. The
future model should let extension packs contribute pinned or bundled skills.

## Catalog

The catalog merges:

- bundled JSON under `orkestrate/profiles/`
- approved items from `orkestrate.space/api/registry` when online

Install copies a template into `~/.orkestrate/profiles/` or the workspace store.

## Session And Config

Orkestrate currently uses `.orkestrate/` for workspace-local profile installs
and generated harness launch artifacts.

For OpenCode launches, Orkestrate creates a temporary per-launch home/config
inside `.orkestrate/sessions/...`, writes generated OpenCode config, launches
OpenCode in the real current directory, and cleans the generated launch folder
when the harness exits.

This should be treated as isolated harness launch config, not long-lived
Orkestrate-owned session management.
