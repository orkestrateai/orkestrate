import DocHeader from "@/components/docs/doc-header";
import CodeBlock from "@/components/CodeBlock";
import Callout from "@/components/docs/callout";
import DocPrevNext from "@/components/docs/prev-next";

export default function WorkbenchPage() {
  return (
    <>
      <DocHeader
        eyebrow="Get started"
        title="Workbench (TUI)"
        description="What you get when you run orkestrate with no subcommand — and what it is not."
        v0Note="The workbench is a pack launcher and catalog UI. Agent chat runs in OpenCode, in a separate terminal window."
      />
      <div className="doc-prose">
        <h2 id="what-it-is">What it is</h2>
        <p>
          Running <code>orkestrate</code> with no arguments starts an <strong>OpenTUI</strong> fullscreen
          terminal UI. It lists installed packs, lets you browse the bundled + registry catalog, install
          packs, see launch status, and spawn OpenCode — it does <strong>not</strong> host an embedded agent
          conversation inside Orkestrate.
        </p>

        <h2 id="runtime">Runtime</h2>
        <p>
          The CLI runs on Bun (<code>#!/usr/bin/env bun</code>). The site installer adds Bun if needed:{" "}
          <code>curl -fsSL https://orkestrate.space/cli/install.sh | bash</code> (or the PowerShell
          equivalent).
        </p>

        <h2 id="first-run">First run (welcome)</h2>
        <p>
          If no packs are installed in the workspace, a welcome screen appears before the main list:
        </p>
        <ul>
          <li>Explains that no packs are installed yet.</li>
          <li>
            <strong>Enter</strong> installs the bundled <code>coding</code> pack (global install path).
          </li>
          <li>
            <strong>Ctrl+C</strong> exits without installing.
          </li>
        </ul>
        <p>After that, the main workbench opens with <code>coding</code> in the installed list.</p>

        <h2 id="screens">Two screens</h2>
        <h3 id="installed">Installed packs (default)</h3>
        <p>
          Title: <strong>Packs</strong>. Each row shows pack id, truncated description, and status:
        </p>
        <ul>
          <li>
            <code>idle</code> — no active launch for this pack in this repo.
          </li>
          <li>
            <code>● running</code> — one or more launches still tracked (footer shows run id or count).
          </li>
        </ul>
        <p>The list refreshes about every 1.5s so status stays current while you keep the workbench open.</p>

        <h3 id="browse">Browse packs</h3>
        <p>
          Press <code>b</code>. Title: <strong>Browse packs</strong>. Shows bundled catalog entries plus
          registry results merged into one list. Tags on rows:
        </p>
        <ul>
          <li>
            <code>[registry]</code> — from orkestrate.space API (when reachable).
          </li>
          <li>
            <code>[installed]</code> — already in <code>.orkestrate/packs/</code>.
          </li>
        </ul>
        <p>
          <strong>Enter</strong> on an uninstalled row runs <code>registry install</code> / bundled install
          for that slug, then switches back to installed view.
        </p>

        <h2 id="launch">What launch does from the workbench</h2>
        <p>
          On an installed pack, <strong>Enter</strong> or <code>l</code> calls the same path as{" "}
          <code>orkestrate run launch &lt;id&gt;</code>:
        </p>
        <ol>
          <li>Syncs the pack harness slice into the pack home (see launch docs).</li>
          <li>Opens a <strong>new terminal window</strong> running OpenCode with that home.</li>
          <li>Your repo remains the working directory; your personal OpenCode config is untouched.</li>
        </ol>
        <p>
          Footer message briefly confirms success or shows the error string. The workbench stays open; OpenCode
          runs in the other window.
        </p>

        <Callout kind="warning" title="Windows">
          Launch requires Windows Terminal (<code>wt</code> on PATH). Without it, launch fails — see
          troubleshooting.
        </Callout>

        <h2 id="keys">Key reference</h2>
        <p>
          <strong>Installed view</strong>
        </p>
        <CodeBlock
          lang="text"
          code={`↑ / ↓ / k / j     Move selection
Enter / l         Launch selected pack
s                 Stop active session(s) for selected pack
b                 Browse catalog
q / Ctrl+C        Quit workbench`}
        />
        <p>
          <strong>Browse view</strong>
        </p>
        <CodeBlock
          lang="text"
          code={`↑ / ↓             Move selection
Enter             Install selected catalog entry
i                 Back to installed packs
Esc               Back to installed packs
q / Ctrl+C        Quit`}
        />

        <h2 id="status-refresh">Status and refresh</h2>
        <p>
          The installed list reconciles runs on a ~1.5s timer while the workbench is open. If you close an
          OpenCode window outside Orkestrate, the row may show <code>running</code> briefly until the next
          reconcile — press <code>s</code> or run <code>orkestrate run list</code> to confirm.
        </p>

        <h2 id="errors">Errors in the footer</h2>
        <p>
          Failed install or launch surfaces the CLI error string in the footer for a few seconds (same text
          you would see in a non-interactive terminal). Common cases: OpenCode not on PATH, missing{" "}
          <code>wt</code> on Windows, unknown pack id, registry unreachable during browse install.
        </p>

        <h2 id="global-packs">Workspace vs global packs in the list</h2>
        <p>
          The workbench resolves packs from the current working directory&apos;s{" "}
          <code>.orkestrate/packs/</code> plus global <code>~/.orkestrate/packs/</code>. Welcome flow
          installs <code>coding</code> globally so first-time users see a pack even in an empty repo.
        </p>

        <h2 id="not-in-tui">Not in the workbench (v0)</h2>
        <ul>
          <li>Chatting with the agent inside Orkestrate.</li>
          <li>Editing harness files (use your editor + <code>pack validate</code>).</li>
          <li>Registry publish / submit (use the website).</li>
          <li>Multi-pack orchestration or handoff between agents.</li>
          <li>Changing OpenCode permissions mid-session (edit pack home or slice, then relaunch).</li>
        </ul>

        <h2 id="cli-alt">CLI without the workbench</h2>
        <p>Every workbench action has a subcommand if you prefer scripts or CI:</p>
        <CodeBlock
          lang="bash"
          code={`orkestrate registry install coding
orkestrate run launch coding
orkestrate run list
orkestrate run stop <run-id>
orkestrate doctor`}
        />
      </div>
      <DocPrevNext href="/docs/workbench" />
    </>
  );
}