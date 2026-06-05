# Demo: extension-builder → new pack → launch

This is the v0 “agents build agents” path using only the CLI (no registry).

## Prerequisites

- Bun 1.3+
- [OpenCode](https://opencode.ai) on `PATH` (`opencode --version`)
- Windows Terminal recommended on Windows

## Steps

From the `orkestrate/` package:

```sh
bun install
bun run src/cli/index.ts doctor
```

### 1. Install builder pack (if needed)

```sh
bun run src/cli/index.ts pack install extension-builder
# or: bun run src/cli/index.ts pack install coding
```

### 2. Scaffold a new pack from template

```sh
bun run src/cli/index.ts pack create demo-agent \
  --from coding \
  --description "Demo pack created by the extension-builder flow"
bun run src/cli/index.ts pack validate demo-agent
```

This writes `.orkestrate/packs/demo-agent/` in your current working directory.

### 3. Launch from CLI

```sh
bun run src/cli/index.ts run launch demo-agent
```

A new terminal tab opens OpenCode. Create a session, then exit OpenCode.

### 4. Prove session persistence

```sh
bun run src/cli/index.ts run launch demo-agent
```

The second window should list the session from step 3 (same pack home under
`.orkestrate/pack-homes/demo-agent/`).

### 5. Launch via TUI

```sh
bun run dev
```

Select `demo-agent` → **Enter**. Status should show **running**, then **idle**
after you close the OpenCode window.

## Optional: run the scripted check

```sh
bun run scripts/demo-pack-builder.ts
```

This runs steps 2–3 non-interactively (does not open OpenCode UI for you).

## Using extension-builder in OpenCode

For the full meta flow, launch the builder pack and ask it to author a pack:

```sh
bun run src/cli/index.ts run launch extension-builder
```

In that OpenCode session, use the bundled `orkestrate-pack-author` skill and CLI
commands (`pack create`, `pack validate`, `run launch`) from a shell in your
real repo cwd.