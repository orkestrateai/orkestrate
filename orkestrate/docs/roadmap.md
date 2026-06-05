# Roadmap

## Layer 1: Skeleton

- Bun TypeScript package
- `orkestrate` command
- MIT license
- README

Status: done.

## Layer 2: Harness Detection

- OpenCode adapter
- `orkestrate doctor`

Status: done.

## Layer 3: Packs (replaces profiles in v0.2)

- `pack.yaml` + `harnesses/opencode/` layout
- workspace + global pack stores
- `pack create|install|validate`
- bundled `coding`, `extension-builder`

Status: done.

## Layer 4: Minimal TUI

- OpenTUI pack list + browse
- per-pack idle/running status
- detached terminal launch (TUI stays open)

Status: done for v0.2.

## Layer 5: OpenCode Launch

- driver compiles pack → launch plan
- new terminal per launch
- per-pack persistent home (shared sessions)

Status: done for v0.2.

## Layer 6: Extensions

- extension loader + OpenCode adapter
- manifest validate/submit
- extension authoring docs

Status: partial. Marketplace install UX, permission sandbox, and setup/apply
workflows are deferred.

## Layer 7: Profile orchestration (target demo)

- meta profile that authors child profiles
- spawn multiple profile instances
- track run completion without manual handoff per instance

Status: not started. Requires execution model beyond single launch handoff.
