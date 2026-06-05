# Architecture

The Orkestrate extension system is designed to dynamically discover, load, and activate modules during the CLI bootstrapping phase. This approach ensures that extensions are isolated and can be injected without modifying the core codebase.

## Discovery and Load Paths

When Orkestrate starts, the `loadExtensions()` routine scans specific directories for executable extensions. The resolution order is strictly prioritized:

1. **Bundled Extensions**: `<package-root>/extensions/`
   First-party extensions that ship with Orkestrate (e.g., `opencode-adapter`).
2. **Global Extensions**: `~/.orkestrate/extensions/`
   User-level extensions installed globally across all projects.
3. **Workspace Extensions**: `<project-cwd>/.orkestrate/extensions/`
   Repository-specific extensions designed for a particular workspace.

If multiple extensions with the same ID are discovered, the loader currently prioritizes them based on the loading sequence, allowing workspace extensions to override global ones.

## The Activation Hook

During startup, Orkestrate filters the discovered directories for valid entry points (`index.ts`, `index.js`, or a valid `package.json` main entry). Once located, it dynamically imports the module and invokes its `activate` method.

### The Extension Context

The `activate` method receives an `ExtensionContext` object. This context acts as the bridge between your extension and the Orkestrate global registry. 

```typescript
export interface ExtensionContext {
  registerAdapter(harness: string, adapter: HarnessAdapter): void;
}
```

Through this context, your extension can safely register its capabilities into the runtime before any profiles are launched.

### Registering an adapter

The harness string in a profile JSON must match the key passed to
`registerAdapter`:

```typescript
activate(ctx) {
  ctx.registerAdapter("opencode", new OpenCodeAdapter());
}
```

## Lifecycle Management & Security

### Current Limitations
- **Deactivation**: Currently, the system lacks a formal `deactivate()` hook. Extensions should avoid spawning orphaned background processes or leaving long-running listeners attached without explicit cleanup mechanisms provided during launch execution.
- **Sandboxing**: Extensions are executed via native dynamic imports (`import()`) within the same V8 isolate as the Orkestrate CLI. As such, they inherit the exact same filesystem and network permissions as the host process. Always verify third-party extension code before installation.
