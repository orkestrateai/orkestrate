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
        description="One-line installer (Bun + CLI), or install the npm package if Bun is already on PATH."
      />
      <div className="doc-prose">
        <h2 id="recommended">Recommended (one line)</h2>
        <p>Scripts live at <code>orkestrate.space/cli/</code> — they install Bun when missing, then the CLI.</p>
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
        <p>
          Pin a version: <code>ORKESTRATE_VERSION=0.2.1 curl -fsSL … | bash</code> (Unix) or set{" "}
          <code>$env:ORKESTRATE_VERSION=&quot;0.2.1&quot;</code> before the PowerShell one-liner.
        </p>

        <h2 id="requirements">Requirements</h2>
        <ul>
          <li>
            <Link href="https://bun.sh">Bun</Link> 1.3+ — runtime for the published CLI (installer adds it if
            needed).
          </li>
          <li>
            <Link href="https://opencode.ai">OpenCode</Link> on PATH — only when you launch a pack.
          </li>
          <li>Windows Terminal (<code>wt</code>) on Windows — for detached launch.</li>
        </ul>

        <h2 id="manual">Manual (Bun already installed)</h2>
        <CodeBlock
          lang="bash"
          code={`npm install -g orkestrate
# or
bun install -g orkestrate

orkestrate doctor`}
        />

        <Callout kind="tip" title="Script source">
          Review before piping:{" "}
          <a href="https://orkestrate.space/cli/install.sh">install.sh</a>,{" "}
          <a href="https://orkestrate.space/cli/install.ps1">install.ps1</a> (also in the repo under{" "}
          <code>website/public/cli/</code>).
        </Callout>

        <h2 id="workbench">Open the workbench</h2>
        <CodeBlock lang="bash" code="orkestrate" />
        <p>
          See <Link href="/docs/workbench">Workbench (TUI)</Link> for screens, keys, and limits.
        </p>

        <h2 id="from-source">From source (contributors)</h2>
        <CodeBlock
          lang="bash"
          code={`git clone https://github.com/orkestrateai/orkestrate.git
cd Orkestrate/orkestrate
bun install
bun run dev`}
        />
      </div>
      <DocPrevNext href="/docs/getting-started/installation" />
    </>
  );
}