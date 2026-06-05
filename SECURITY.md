# Security

Orkestrate launches local agent harnesses and may pass prompts, skills, MCP
definitions, paths, and extension code into those harnesses.

## Trust model (v0)

- Intended for **local, trusted** use on your machine.
- **OpenCode** is the executing harness for launch builds.
- **Orkestrate extensions** load via dynamic `import()` in the same process as
  the CLI — treat them as trusted code (no sandbox).
- Do not commit secrets. Keep `.env*` and `.orkestrate/` out of git.

## Reporting

Open a [GitHub security advisory](https://github.com/system1970/Orkestrate/security/advisories/new) with:

- affected version or commit
- reproduction steps
- impact (data exposure, arbitrary execution, etc.)

Do not post exploit details publicly before maintainers respond.