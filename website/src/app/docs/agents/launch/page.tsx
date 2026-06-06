import DocHeader from "@/components/docs/doc-header";
import CodeBlock from "@/components/CodeBlock";
import Callout from "@/components/docs/callout";
import DocPrevNext from "@/components/docs/prev-next";
import Link from "next/link";

export default function LaunchPage() {
  return (
    <>
      <DocHeader
        eyebrow="Agents"
        title="Launch and pack homes"
        description="How run launch opens a new terminal, isolates OpenCode state per pack, and tracks runs without touching your personal config."
      />
      <div className="doc-prose">
        <h2 id="model">Launch model</h2>
        <p>
          <code>orkestrate run launch &lt;pack-id&gt;</code> (or <code>run spawn</code> — alias) does{" "}
          <strong>not</strong> start agent chat inside the Orkestrate workbench. It:
        </p>
        <ol>
          <li>Resolves the pack from workspace/global install paths.</li>
          <li>Syncs the harness slice into the pack home (see sync rules below).</li>
          <li>Spawns a <strong>new terminal window</strong> running OpenCode with hijacked home/XDG env.</li>
          <li>Records a run under <code>.orkestrate/runs/&lt;run-id&gt;/</code>.</li>
        </ol>
        <CodeBlock
          lang="bash"
          code={`orkestrate run launch coding
# runId=...
# pack=coding
# state=running
# Opened new terminal: ...`}
        />

        <h2 id="cwd">Working directory</h2>
        <p>
          OpenCode starts in your <strong>current repository</strong> (the cwd where you invoked
          Orkestrate). Pack homes hold config and session state — not a separate clone of your project.
        </p>

        <h2 id="home">Pack home layout</h2>
        <CodeBlock
          lang="text"
          code={`<workspace>/.orkestrate/pack-homes/<pack-id>/
  home/                              # synthetic HOME for this pack
    .config/opencode/                  # synced slice + local overrides
    .local/share/                      # XDG data
    .local/state/                      # XDG state
    .cache/                            # XDG cache`}
        />
        <p>
          Every launch of the same pack in the same repo shares this home — OpenCode session history and
          synced config persist. A different repo gets a different pack home tree.
        </p>

        <h2 id="isolation">Isolation from personal OpenCode</h2>
        <p>
          Your default <code>~/.config/opencode</code> (and normal OpenCode invocations outside Orkestrate)
          are unchanged. Only the child process launched by Orkestrate receives the pack home environment.
        </p>

        <h2 id="sync">Harness sync on launch</h2>
        <ul>
          <li>
            <strong>First launch</strong> — entire <code>harnesses/opencode/</code> tree copied into pack
            home config.
          </li>
          <li>
            <strong>Subsequent launches</strong> — add missing agents, skills, plugins; do not overwrite
            existing <code>opencode.json</code> in the home.
          </li>
        </ul>
        <p>
          Edit live config under <code>pack-homes/.../home/.config/opencode/</code> to tune one repo without
          mutating <code>.orkestrate/packs/&lt;id&gt;/</code> source.
        </p>

        <h2 id="runs">Run records</h2>
        <CodeBlock
          lang="text"
          code={`<workspace>/.orkestrate/runs/<run-id>/
  # metadata: pack id, pid, state, startedAt, title`}
        />
        <p>CLI:</p>
        <CodeBlock
          lang="bash"
          code={`orkestrate run list
orkestrate run status <run-id>
orkestrate run stop <run-id>`}
        />
        <p>
          The workbench polls runs ~every 1.5s and shows <code>idle</code> or <code>running</code> on pack
          rows. Press <code>s</code> on a pack to stop tracked sessions for that pack.
        </p>

        <h2 id="multi">Multiple instances</h2>
        <p>
          You can launch the same <code>pack-id</code> multiple times; each launch gets a unique{" "}
          <code>runId</code> and terminal. They share the same pack home (same OpenCode session store) —
          intentional for one agent identity per pack per repo.
        </p>

        <h2 id="windows">Windows</h2>
        <Callout kind="warning" title="Requires Windows Terminal">
          Launch uses <code>wt</code> to open a detached window. If launch fails with file-not-found
          (0x80070002), install Windows Terminal and ensure <code>wt</code> is on PATH. Run{" "}
          <code>orkestrate doctor</code>.
        </Callout>

        <h2 id="driver">OpenCode driver</h2>
        <p>
          Implementation: <code>extensions/opencode-adapter/</code>. Sets env vars (
          <code>XDG_CONFIG_HOME</code>, <code>HOME</code> hijack on Unix, analogous paths on Windows) and
          invokes <code>opencode</code> from PATH.
        </p>

        <h2 id="next">Related</h2>
        <ul>
          <li>
            <Link href="/docs/workbench">Workbench (TUI)</Link> — launch from UI
          </li>
          <li>
            <Link href="/docs/help/troubleshooting">Troubleshooting</Link> — launch failures
          </li>
          <li>
            <Link href="/docs/reference/cli">CLI reference</Link> — all run subcommands
          </li>
        </ul>
      </div>
      <DocPrevNext href="/docs/agents/launch" />
    </>
  );
}