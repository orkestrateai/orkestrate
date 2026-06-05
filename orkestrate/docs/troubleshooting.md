# Troubleshooting

## Bun EPERM Noise On Windows/OneDrive

In this workspace, Bun sometimes prints messages like:

```text
error: Cannot read file "C:\Users\..."
```

after an otherwise successful command.

This has been observed even with a minimal command such as:

```sh
bun -e "console.log('hi')"
```

So far it appears to be Bun or shell/path probing noise related to the Windows
OneDrive path, not Orkestrate command failure. Treat the command exit code and
the Orkestrate output as the source of truth.

If this appears outside OneDrive or with a non-zero exit code, capture:

- the command
- the full output
- `bun --version`
- the working directory path
