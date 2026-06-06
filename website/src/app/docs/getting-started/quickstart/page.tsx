import DocHeader from "@/components/docs/doc-header";
import CodeBlock from "@/components/CodeBlock";
import Callout from "@/components/docs/callout";
import DocPrevNext from "@/components/docs/prev-next";
import Link from "next/link";

export default function QuickstartPage() {
  return (
    <>
      <DocHeader
        eyebrow="Get started"
        title="Quickstart"
        description="Install the CLI, install your first pack, open the workbench, and launch OpenCode in a separate terminal — end to end in five minutes."
        v0Note="Agent work happens in OpenCode (new terminal). Orkestrate is the installer, catalog, and launcher."
      />
      <div className="doc-prose">
        <h2 id="prerequisites">Before you start</h2>
        <ul>
          <li>
            macOS, Linux, or Windows 10+ with PowerShell for the installer.
          </li>
          <li>
            <Link href="https://opencode.ai">OpenCode</Link> on PATH — required only when you launch a
            pack (install can happen first).
          </li>
          <li>
            Windows: <Link href="https://aka.ms/terminal">Windows Terminal</Link> with <code>wt</code> on
            PATH for detached launches.
          </li>
        </ul>

        <h2 id="install-cli">1. Install the CLI</h2>
        <p>
          Full options and version pinning: <Link href="/docs/getting-started/installation">Installation</Link>.
        </p>
        <CodeBlock
          lang="bash"
          filename="macOS / Linux"
          code={`curl -fsSL https://orkestrate.space/cli/install.sh | bash
orkestrate doctor`}
        />
        <CodeBlock
          lang="powershell"
          filename="Windows"
          code={`irm https://orkestrate.space/cli/install.ps1 | iex
orkestrate doctor`}
        />
        <p>
          <code>doctor</code> prints installed packs and whether the OpenCode driver is detected. An empty
          pack list on first run is expected.
        </p>

        <h2 id="pack">2. Install a pack</h2>
        <p>
          <strong>Path A — welcome flow.</strong> Run <code>orkestrate</code> with no arguments. If no packs
          are installed, the welcome screen offers to install the bundled <code>coding</code> pack (global
          install path). Press <strong>Enter</strong> to accept.
        </p>
        <p>
          <strong>Path B — explicit install.</strong> Install from the public registry (same packs as the
          website catalog):
        </p>
        <CodeBlock lang="bash" code="orkestrate registry install coding" />
        <p>
          For pack authoring later, also install the meta pack:
        </p>
        <CodeBlock lang="bash" code="orkestrate registry install extension-builder" />

        <h2 id="workbench">3. Open the workbench</h2>
        <CodeBlock lang="bash" code="orkestrate" />
        <p>
          You should see the <strong>Packs</strong> screen with <code>coding</code> (and any others you
          installed). Each row shows <code>idle</code> until you launch.
        </p>
        <table>
          <thead>
            <tr>
              <th>Key</th>
              <th>Installed view</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>↑</code> / <code>↓</code> / <code>k</code> / <code>j</code>
              </td>
              <td>Move selection</td>
            </tr>
            <tr>
              <td>
                <code>b</code>
              </td>
              <td>Browse bundled + registry catalog</td>
            </tr>
            <tr>
              <td>
                <code>Enter</code> / <code>l</code>
              </td>
              <td>Launch selected pack</td>
            </tr>
            <tr>
              <td>
                <code>s</code>
              </td>
              <td>Stop active session(s) for selected pack</td>
            </tr>
            <tr>
              <td>
                <code>q</code> / Ctrl+C
              </td>
              <td>Quit workbench</td>
            </tr>
          </tbody>
        </table>
        <p>
          Full reference: <Link href="/docs/workbench">Workbench (TUI)</Link>.
        </p>

        <h2 id="launch">4. Launch OpenCode</h2>
        <p>
          Select <code>coding</code>, press <strong>Enter</strong> or <code>l</code>. Orkestrate:
        </p>
        <ol>
          <li>Syncs the pack harness slice into the pack home for this repo.</li>
          <li>Opens a <strong>new terminal window</strong> running OpenCode with that home.</li>
          <li>Leaves the workbench open in your original terminal.</li>
        </ol>
        <p>CLI equivalent:</p>
        <CodeBlock lang="bash" code="orkestrate run launch coding" />
        <p>Output includes <code>runId=...</code> for tracking.</p>

        <Callout kind="tip" title="Where sessions live">
          <code>.orkestrate/pack-homes/coding/home/</code> in your project root — not your default OpenCode
          config. Relaunching <code>coding</code> in the same repo continues the same pack session context.
        </Callout>

        <h2 id="agent-session">5. Work in OpenCode</h2>
        <p>
          The new window is a normal OpenCode session with the <code>coding</code> agent, permissions, and
          skills from the pack slice. The <code>orkestrate</code> skill (if enabled in{" "}
          <code>opencode.json</code>) lets the agent launch other installed packs in additional terminals —
          useful for multi-pack workflows.
        </p>

        <h2 id="stop">6. Stop a launch</h2>
        <ul>
          <li>
            Close the OpenCode terminal window, or
          </li>
          <li>
            In the workbench: select the pack → <code>s</code>, or
          </li>
          <li>
            CLI: <code>orkestrate run list</code> then <code>orkestrate run stop &lt;run-id&gt;</code>
          </li>
        </ul>

        <h2 id="author-path">7. Optional — author a pack</h2>
        <p>After installing <code>extension-builder</code>:</p>
        <CodeBlock
          lang="bash"
          code={`orkestrate pack create my-agent --from extension-builder
orkestrate pack validate my-agent
orkestrate run launch my-agent`}
        />
        <p>
          OpenCode in the new window can load the <code>orkestrate-pack-author</code> skill for guided pack
          layout. See <Link href="/docs/agents/packs">Agent packs</Link> and{" "}
          <Link href="/docs/harnesses/authoring">Authoring harness slices</Link>.
        </p>

        <h2 id="verify">Verify everything</h2>
        <CodeBlock
          lang="bash"
          code={`orkestrate doctor
orkestrate pack list
orkestrate registry list
orkestrate run list`}
        />

        <h2 id="next">Next steps</h2>
        <ul>
          <li>
            <Link href="/docs/concepts">Concepts</Link> — mental model and terminology
          </li>
          <li>
            <Link href="/docs/agents/launch">Launch & pack homes</Link> — sync rules and paths
          </li>
          <li>
            <Link href="/registry">Registry</Link> — browse more packs
          </li>
          <li>
            <Link href="/docs/help/troubleshooting">Troubleshooting</Link> — launch and PATH issues
          </li>
        </ul>
      </div>
      <DocPrevNext href="/docs/getting-started/quickstart" />
    </>
  );
}