import DocHeader from "@/components/docs/doc-header";
import CodeBlock from "@/components/CodeBlock";
import Callout from "@/components/docs/callout";
import DocPrevNext from "@/components/docs/prev-next";
import Link from "next/link";

export default function InstallationPage() {
  return (
    <>
      <DocHeader
        eyebrow="Get started"
        title="Installation"
        description="Install Bun and the Orkestrate CLI via one-line scripts, manual package managers, or from source for contributors."
      />
      <div className="doc-prose">
        <h2 id="recommended">Recommended — one-line installer</h2>
        <p>
          Scripts are served from <code>orkestrate.space/cli/</code>. They detect Bun, install it when
          missing, then install the global <code>orkestrate</code> CLI package.
        </p>
        <CodeBlock
          lang="bash"
          filename="macOS / Linux"
          code="curl -fsSL https://orkestrate.space/cli/install.sh | bash"
        />
        <CodeBlock
          lang="powershell"
          filename="Windows (PowerShell)"
          code="irm https://orkestrate.space/cli/install.ps1 | iex"
        />
        <p>After install, verify:</p>
        <CodeBlock lang="bash" code="orkestrate doctor" />

        <h2 id="pin-version">Pin a version</h2>
        <p>
          Useful for reproducible CI images or team onboarding. The installer passes the version to{" "}
          <code>bun install -g orkestrate@&lt;version&gt;</code>.
        </p>
        <CodeBlock
          lang="bash"
          filename="Unix"
          code="ORKESTRATE_VERSION=0.2.1 curl -fsSL https://orkestrate.space/cli/install.sh | bash"
        />
        <CodeBlock
          lang="powershell"
          filename="Windows"
          code={`$env:ORKESTRATE_VERSION = "0.2.1"
irm https://orkestrate.space/cli/install.ps1 | iex`}
        />

        <h2 id="requirements">Requirements</h2>
        <table>
          <thead>
            <tr>
              <th>Component</th>
              <th>When needed</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <Link href="https://bun.sh">Bun</Link> 1.3+
              </td>
              <td>Always (CLI runtime)</td>
              <td>Installer adds Bun if missing. Manual install requires Bun on PATH.</td>
            </tr>
            <tr>
              <td>
                <Link href="https://opencode.ai">OpenCode</Link>
              </td>
              <td>Launch only</td>
              <td>
                <code>orkestrate doctor</code> reports driver detection per installed pack.
              </td>
            </tr>
            <tr>
              <td>Windows Terminal (<code>wt</code>)</td>
              <td>Launch on Windows</td>
              <td>Detached new-window launch. See troubleshooting if launch fails.</td>
            </tr>
            <tr>
              <td>Git</td>
              <td>Registry install</td>
              <td>CLI clones packs from GitHub <code>source_url</code>.</td>
            </tr>
          </tbody>
        </table>

        <h2 id="manual">Manual install (Bun already on PATH)</h2>
        <CodeBlock
          lang="bash"
          code={`bun install -g orkestrate
# or
npm install -g orkestrate

orkestrate doctor`}
        />
        <Callout kind="note" title="npm vs bun">
          The published package runs on Bun (<code>#!/usr/bin/env bun</code>). Prefer{" "}
          <code>bun install -g</code> or the site installer. Plain <code>npm install -g</code> works when
          Bun is already available as the runtime for the bin shim.
        </Callout>

        <h2 id="path">PATH and shell</h2>
        <p>
          Global installs land in Bun&apos;s or npm&apos;s global bin directory. If <code>orkestrate</code> is
          not found after install, restart the terminal or add the reported global bin path to your shell
          profile (<code>~/.bashrc</code>, <code>~/.zshrc</code>, or Windows user PATH).
        </p>

        <h2 id="workbench">Open the workbench</h2>
        <CodeBlock lang="bash" code="orkestrate" />
        <p>
          No subcommand starts the OpenTUI workbench. See{" "}
          <Link href="/docs/workbench">Workbench (TUI)</Link> for screens, keys, and limits.
        </p>

        <h2 id="from-source">From source (contributors)</h2>
        <p>Monorepo layout: CLI in <code>orkestrate/</code>, website in <code>website/</code>.</p>
        <CodeBlock
          lang="bash"
          code={`git clone https://github.com/orkestrateai/orkestrate.git
cd orkestrate
bun install
bun run check
bun run dev`}
        />
        <p>
          <code>bun run dev</code> runs the CLI entrypoint without a global install. Website local dev:
        </p>
        <CodeBlock
          lang="bash"
          code={`cd website
bun install
cp .env.example .env.local   # add Supabase keys for registry/submit
bun run dev`}
        />

        <h2 id="env">Environment variables</h2>
        <table>
          <thead>
            <tr>
              <th>Variable</th>
              <th>Default</th>
              <th>Purpose</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>ORKESTRATE_REGISTRY_URL</code>
              </td>
              <td>
                <code>https://orkestrate.space/api/registry</code>
              </td>
              <td>Override registry API for local website dev or staging.</td>
            </tr>
            <tr>
              <td>
                <code>ORKESTRATE_BUNDLED_REPO_URL</code>
              </td>
              <td>GitHub monorepo URL in API</td>
              <td>Website-only: bundled pack clone source in registry API responses.</td>
            </tr>
          </tbody>
        </table>

        <h2 id="uninstall">Uninstall</h2>
        <CodeBlock
          lang="bash"
          code={`bun remove -g orkestrate
# or
npm uninstall -g orkestrate`}
        />
        <p>
          Workspace data under <code>.orkestrate/</code> is not removed automatically. Delete that directory
          in a repo if you want a clean slate for packs and pack homes.
        </p>

        <Callout kind="tip" title="Review scripts before piping">
          Source:{" "}
          <a href="https://orkestrate.space/cli/install.sh">install.sh</a>,{" "}
          <a href="https://orkestrate.space/cli/install.ps1">install.ps1</a> (also in{" "}
          <code>website/public/cli/</code> and <code>orkestrate/scripts/</code>).
        </Callout>
      </div>
      <DocPrevNext href="/docs/getting-started/installation" />
    </>
  );
}