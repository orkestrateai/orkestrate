# Agent Rules

## Package Manager Policy
- Always use `bun` for package management and scripts.
- Always use `bunx` for one-off CLI execution.
- Do not use `npm` or `npx`.

## Build Stage Policy (Early-Stage)
- This project is in early-stage single-builder mode.
- Prioritize clean, strict architecture over backward compatibility.
- Do not add legacy shims, compatibility fallbacks, or dual old/new flows unless explicitly requested.
- Prefer breaking changes that simplify the protocol and make behavior deterministic.
- Optimize for correctness and fast iteration for one active tester/maintainer.

## Command Examples
- Install dependencies: `bun install`
- Add dependency: `bun add <package>`
- Add dev dependency: `bun add -d <package>`
- Run script: `bun run <script>`
- Run ESLint directly: `bunx eslint <path>`
