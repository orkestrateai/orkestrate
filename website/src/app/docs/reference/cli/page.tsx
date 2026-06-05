import DocHeader from "@/components/docs/doc-header";
import Callout from "@/components/docs/callout";
import DocPrevNext from "@/components/docs/prev-next";
import Link from "next/link";

export default function CliReferencePage() {
  return (
    <>
      <DocHeader
        eyebrow="Reference"
        title="CLI reference"
        description="Subcommands that ship today. No subcommand opens the OpenTUI workbench."
      />
      <div className="doc-prose">
        <h2 id="workbench">Default (workbench)</h2>
        <p>
          <code>orkestrate</code> — OpenTUI. See <Link href="/docs/workbench">Workbench (TUI)</Link>.
        </p>

        <h2 id="doctor">doctor</h2>
        <p>
          <code>orkestrate doctor</code> — lists installed packs and whether each pack&apos;s harness driver
          (OpenCode) is detected on PATH.
        </p>

        <h2 id="pack">pack</h2>
        <ul>
          <li>
            <code>pack list</code> — installed packs in workspace (and global when applicable).
          </li>
          <li>
            <code>pack install &lt;slug&gt;</code> — install from bundled catalog in the package.
          </li>
          <li>
            <code>pack create &lt;id&gt; --from coding</code> — scaffold from <code>coding</code> or{" "}
            <code>extension-builder</code>.
          </li>
          <li>
            <code>pack validate &lt;id&gt;</code> — layout + harness slice checks.
          </li>
        </ul>
        <Callout kind="note" title="Not shipped">
          <code>pack submit</code> — use the <Link href="/submit">web publish flow</Link>.
        </Callout>

        <h2 id="run">run</h2>
        <ul>
          <li>
            <code>run launch &lt;pack-id&gt;</code> — new terminal + OpenCode + pack home.
          </li>
          <li>
            <code>run list</code> — launch records under <code>.orkestrate/runs/</code>.
          </li>
          <li>
            <code>run status</code> — summary of active runs.
          </li>
          <li>
            <code>run stop &lt;run-id&gt;</code> — stop a tracked launch.
          </li>
        </ul>

        <h2 id="registry">registry</h2>
        <ul>
          <li>
            <code>registry list</code>
          </li>
          <li>
            <code>registry search &lt;query&gt;</code>
          </li>
          <li>
            <code>registry install &lt;slug&gt;</code> — clone/install from catalog entry (GitHub{" "}
            <code>source_url</code>).
          </li>
        </ul>

        <h2 id="extension">extension</h2>
        <p>
          <code>extension validate &lt;path&gt;</code> — validate an Orkestrate extension manifest (OpenCode
          adapter lives under <code>extensions/opencode-adapter/</code> in the repo).
        </p>
      </div>
      <DocPrevNext href="/docs/reference/cli" />
    </>
  );
}