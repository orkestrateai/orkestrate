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
        description="End-to-end: install CLI, get a pack, use the workbench, launch OpenCode elsewhere."
        v0Note="Agent work happens in OpenCode (new terminal). Orkestrate is the installer and launcher."
      />
      <div className="doc-prose">
        <h2 id="install-cli">1. Install</h2>
        <p>
          <Link href="/docs/getting-started/installation">Installation</Link> — one-liner or manual npm/bun.
        </p>
        <CodeBlock
          lang="bash"
          code={`curl -fsSL https://orkestrate.space/cli/install.sh | bash
orkestrate doctor`}
        />

        <h2 id="pack">2. Get a pack</h2>
        <p>Either use the welcome flow (first <code>orkestrate</code> installs <code>coding</code>) or:</p>
        <CodeBlock lang="bash" code="orkestrate registry install coding" />

        <h2 id="workbench">3. Workbench</h2>
        <CodeBlock lang="bash" code="orkestrate" />
        <p>You should see the <strong>Packs</strong> list with <code>coding</code> and an <code>idle</code> or running status.</p>
        <ul>
          <li>
            <code>b</code> — browse bundled + registry catalog; <code>Enter</code> installs a row.
          </li>
          <li>
            <code>i</code> — back to installed list from browse.
          </li>
          <li>
            Full key map: <Link href="/docs/workbench">Workbench (TUI)</Link>.
          </li>
        </ul>

        <h2 id="launch">4. Launch</h2>
        <p>
          Select <code>coding</code>, press <strong>Enter</strong> or <code>l</code>. A{" "}
          <strong>new terminal</strong> opens with OpenCode using the pack harness and an isolated pack home.
          Orkestrate stays open in the original terminal.
        </p>
        <CodeBlock lang="bash" code="orkestrate run launch coding" />

        <Callout kind="tip" title="Where sessions live">
          <code>.orkestrate/pack-homes/coding/home/</code> in your repo — not your default OpenCode config
          directory.
        </Callout>

        <h2 id="stop">5. Stop a launch</h2>
        <p>
          In the workbench, select the pack and press <code>s</code> to stop tracked sessions. Or use{" "}
          <code>orkestrate run list</code> and <code>orkestrate run stop &lt;run-id&gt;</code>.
        </p>

        <h2 id="next">Next</h2>
        <ul>
          <li>
            <Link href="/docs/agents/launch">Launch & pack homes</Link>
          </li>
          <li>
            <Link href="/docs/agents/packs">Agent packs</Link>
          </li>
          <li>
            <Link href="/registry">Registry</Link>
          </li>
        </ul>
      </div>
      <DocPrevNext href="/docs/getting-started/quickstart" />
    </>
  );
}