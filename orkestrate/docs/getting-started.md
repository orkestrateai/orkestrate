# Getting Started

Orkestrate is a Bun CLI and OpenTUI workbench for **packs** (OpenCode-first).

## Install

```sh
cd orkestrate
bun install
```

## Run the workbench

```sh
bun run dev
```

On first launch with no packs installed, the welcome wizard installs `coding`.

## Check harness status

```sh
bun run src/cli/index.ts doctor
```

## Create a pack

```sh
bun run src/cli/index.ts pack create my-agent --from coding
bun run src/cli/index.ts pack validate my-agent
```

Templates: `coding`, `extension-builder` (use `--from <name>`).

## Install packs

Bundled:

```sh
bun run src/cli/index.ts pack install coding
bun run src/cli/index.ts pack install extension-builder --global
```

Registry (GitHub-backed, requires network):

```sh
bun run src/cli/index.ts registry list
bun run src/cli/index.ts registry search <query>
bun run src/cli/index.ts registry install <slug>
```

In the TUI: `b` to browse bundled + registry, `Enter` to install.

## Launch a pack

CLI:

```sh
bun run src/cli/index.ts run launch coding
```

TUI: select a pack → `Enter` or `l`.

Orkestrate opens a **new terminal** running OpenCode with:

- Your real repo as `cwd`
- Config from the pack harness slice
- Session data under `.orkestrate/pack-homes/<pack-id>/home/`

Your normal OpenCode config is not modified.

## Where files live

```text
<workspace>/.orkestrate/packs/<id>/       # pack source
<workspace>/.orkestrate/pack-homes/<id>/  # persistent OpenCode home
~/.orkestrate/packs/<id>/                 # global install (optional)
```

Bundled catalog: `orkestrate/packs/`.

## Next

- [Pack authoring](pack-authoring.md)
- [Extension-builder demo](demo-extension-builder.md)