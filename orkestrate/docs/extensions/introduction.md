# Extensions

Extensions register runtime capabilities when the CLI starts. Today the main
contribution type is a **harness adapter**.

## OrkExtension

```typescript
export interface OrkExtension {
  id: string;
  name: string;
  version: string;
  activate(ctx: ExtensionContext): void | Promise<void>;
}
```

## Discovery paths

1. `<package>/extensions/` — bundled (e.g. `opencode-adapter`)
2. `~/.orkestrate/extensions/`
3. `<workspace>/.orkestrate/extensions/`

## Docs

- [Architecture & lifecycle](./architecture.md) — load order, `ExtensionContext`, security
- [Harness adapters](./adapters.md) — `HarnessAdapter` contract and OpenCode example