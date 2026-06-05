# Security

Orkestrate launches local agent harnesses and may pass prompts, skills, MCP
definitions, paths, and extension code into those harnesses.

## Trust model (v0)

- Intended for **local, trusted** use on your machine.
- **OpenCode** is the executing harness for launch builds.
- **Orkestrate extensions** load via dynamic `import()` in the same process as
  the CLI — treat them as trusted code (no sandbox).
- **OpenCode plugins** are separate; they run inside OpenCode per
  [OpenCode plugin docs](https://opencode.ai/docs/plugins/).
- Do not commit secrets. Keep `.env*` and `.orkestrate/` out of git.

## Reporting

Open a private security advisory or email maintainers with:

- affected version or commit
- reproduction steps
- impact (data exposure, arbitrary execution, etc.)

Do not post exploit details publicly before maintainers respond.