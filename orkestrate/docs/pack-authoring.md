# Pack authoring

A **pack** is a reusable agent product: manifest + native OpenCode harness files.
Orkestrate launches it in a **new terminal** with an isolated home that does not
touch your normal OpenCode install.

## Layout

```text
my-pack/
  pack.yaml              # id, description, harness
  info.md                # optional readme for humans/agents
  harnesses/opencode/
    opencode.json        # native OpenCode config
    agents/<name>.md     # primary agent prompt
    skills/              # optional OpenCode skills
```

## Scaffold a pack

```sh
cd orkestrate
bun run src/cli/index.ts pack create my-pack --from coding
bun run src/cli/index.ts pack validate my-pack
bun run src/cli/index.ts run launch my-pack
```

Workspace copies live at `<repo>/.orkestrate/packs/<id>/`.
Global copies live at `~/.orkestrate/packs/<id>/` (use `--global`).

## Sessions

OpenCode session data for a pack is stored under:

```text
<workspace>/.orkestrate/pack-homes/<pack-id>/home/
```

Every launch of the same pack in the same repo shares that home, so session
history persists. Your personal OpenCode outside Orkestrate is unchanged.

## Runs

Each launch also creates a small run record under `.orkestrate/runs/<run-id>/`
(launch metadata only). The TUI shows **idle** / **running** on each pack row.

## Harness sync on launch

The OpenCode driver copies `harnesses/opencode/` into the pack home on launch:

- **First launch:** full slice is copied.
- **Later launches:** only missing `agents/`, `skills/`, and `plugins/` files are
  added. Your `opencode.json` in the pack home is never overwritten.

Edit agents/skills in `.orkestrate/pack-homes/<pack-id>/home/.config/opencode/` to
customize a pack for this workspace without changing the installed pack source.

## Registry install

```sh
bun run src/cli/index.ts registry list
bun run src/cli/index.ts registry search coding
bun run src/cli/index.ts registry install <slug>
```

Remote packs are cloned from GitHub (`source_url` + `orkestrate.ref` / `orkestrate.packPath`
in the registry manifest). The repo must contain `pack.yaml` at the pack path.

## Bundled templates

- `coding` — day-to-day software work
- `extension-builder` — includes `orkestrate` and `orkestrate-pack-author` skills

See [demo-extension-builder.md](./demo-extension-builder.md) for the full
builder → new pack → launch walkthrough.