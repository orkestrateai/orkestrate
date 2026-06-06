import DocHeader from "@/components/docs/doc-header";
import CodeBlock from "@/components/CodeBlock";
import Callout from "@/components/docs/callout";
import DocPrevNext from "@/components/docs/prev-next";
import Link from "next/link";

export default function TroubleshootingPage() {
  return (
    <>
      <DocHeader
        eyebrow="Help"
        title="Troubleshooting"
        description="Diagnose install, launch, registry, and workbench issues with concrete checks and fixes."
      />
      <div className="doc-prose">
        <h2 id="doctor-first">Start with doctor</h2>
        <CodeBlock lang="bash" code="orkestrate doctor" />
        <p>
          Confirms packs are installed and whether the OpenCode driver is reachable. If OpenCode is missing,
          install from <Link href="https://opencode.ai">opencode.ai</Link> before launch.
        </p>

        <h2 id="command-not-found">orkestrate: command not found</h2>
        <ul>
          <li>Reopen the terminal after install.</li>
          <li>
            Confirm Bun/npm global bin is on PATH (<code>bun pm bin -g</code> or npm prefix).
          </li>
          <li>Re-run the site installer or <code>bun install -g orkestrate</code>.</li>
        </ul>

        <h2 id="launch-windows">Launch fails on Windows (0x80070002)</h2>
        <p>
          Orkestrate opens a <strong>new</strong> window via Windows Terminal (<code>wt</code>). If{" "}
          <code>wt</code> is missing:
        </p>
        <ol>
          <li>Install Windows Terminal from the Microsoft Store.</li>
          <li>Ensure <code>wt</code> is on PATH (open a new PowerShell and run <code>wt -h</code>).</li>
          <li>Retry <code>orkestrate run launch coding</code>.</li>
        </ol>

        <h2 id="launch-unix">Launch fails on macOS / Linux</h2>
        <ul>
          <li>
            Verify <code>opencode</code> is on PATH in the same environment as Orkestrate.
          </li>
          <li>
            Check terminal emulator allows new windows (some SSH-only sessions cannot spawn GUI terminals).
          </li>
          <li>
            Read stderr from <code>run launch</code> — driver errors include missing binary or sync failures.
          </li>
        </ul>

        <h2 id="stale-running">Pack stuck on running</h2>
        <p>
          The workbench marks a pack <code>running</code> while run records think a process is active.
        </p>
        <ul>
          <li>Close the OpenCode terminal window manually.</li>
          <li>
            Workbench: select pack → <code>s</code>.
          </li>
          <li>
            CLI: <code>orkestrate run list</code> → <code>orkestrate run stop &lt;run-id&gt;</code>.
          </li>
        </ul>
        <p>
          <code>run list</code> reconciles stale PIDs on each invocation.
        </p>

        <h2 id="registry">Registry / install failures</h2>
        <h3 id="registry-unreachable">Could not reach registry</h3>
        <p>
          Check network and <code>ORKESTRATE_REGISTRY_URL</code>. Bundled installs still work:{" "}
          <code>orkestrate pack install coding</code>.
        </p>
        <h3 id="registry-clone">GitHub clone failed</h3>
        <p>
          Ensure <code>source_url</code> is public, git is installed, and corporate proxies allow GitHub.
          For monorepo packs, manifest must include correct <code>orkestrate.packPath</code>.
        </p>
        <h3 id="registry-404">Website API 404 / empty</h3>
        <p>
          Production needs <code>/api/registry</code> and Supabase env vars on Vercel. Local dev: copy{" "}
          <code>website/.env.example</code> → <code>.env.local</code> with Supabase keys.
        </p>

        <h2 id="validate">pack validate errors</h2>
        <ul>
          <li>
            <code>pack.yaml</code> <code>id</code> must match directory name.
          </li>
          <li>
            <code>harness: opencode</code> requires <code>harnesses/opencode/opencode.json</code>.
          </li>
          <li>
            Run validate from repo root or pass pack id known to <code>.orkestrate/packs/</code>.
          </li>
        </ul>

        <h2 id="submit-auth">Submit / GitHub auth</h2>
        <p>
          Publishing uses Supabase Auth → GitHub provider (not local <code>GITHUB_CLIENT_ID</code> in the
          Next app). Redirect URL must include <code>https://orkestrate.space/auth/callback</code> in
          Supabase dashboard. If login loops, clear cookies and retry.
        </p>

        <h2 id="env">Environment reference</h2>
        <CodeBlock
          lang="bash"
          code={`export ORKESTRATE_REGISTRY_URL=https://orkestrate.space/api/registry
# website only:
export ORKESTRATE_BUNDLED_REPO_URL=https://github.com/orkestrateai/orkestrate`}
        />

        <Callout kind="tip" title="More FAQ">
          <Link href="/docs/help/common-issues">Common issues</Link> — pack vs harness, Pi support, publish
          path.
        </Callout>
      </div>
      <DocPrevNext href="/docs/help/troubleshooting" />
    </>
  );
}