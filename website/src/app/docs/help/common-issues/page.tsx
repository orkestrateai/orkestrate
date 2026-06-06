import DocHeader from "@/components/docs/doc-header";
import DocPrevNext from "@/components/docs/prev-next";
import Link from "next/link";

export default function CommonIssuesPage() {
  return (
    <>
      <DocHeader
        eyebrow="Help"
        title="Common issues"
        description="FAQ for installers, daily use, pack authors, and publishers."
      />
      <div className="doc-prose">
        <h2 id="difference-pack-harness">What is the difference between a pack and a harness?</h2>
        <p>
          The <strong>pack</strong> is the agent product: <code>pack.yaml</code> plus identity metadata. The{" "}
          <strong>harness slice</strong> is how that agent runs for a specific task — OpenCode JSON, agents,
          skills under <code>harnesses/opencode/</code>. One pack carries one primary slice in v0; the
          layout supports richer slices over time.
        </p>

        <h2 id="touch-opencode">Does Orkestrate modify my OpenCode?</h2>
        <p>
          No. Only the child process launched for a pack uses an isolated pack home. Your personal OpenCode
          config and sessions outside Orkestrate are untouched.
        </p>

        <h2 id="where-chat">Where do I chat with the agent?</h2>
        <p>
          In the <strong>new terminal</strong> opened by launch — the OpenCode TUI/CLI. The Orkestrate
          workbench lists packs and spawns runs; it does not embed agent conversation.
        </p>

        <h2 id="workspace-vs-global">Workspace vs global install?</h2>
        <p>
          Workspace installs live in <code>&lt;repo&gt;/.orkestrate/packs/</code> and travel with the
          project. Global installs live in <code>~/.orkestrate/packs/</code> and are visible from any cwd.
          The welcome flow installs <code>coding</code> globally. Use <code>--global</code> on{" "}
          <code>registry install</code> or <code>pack create</code> for the same.
        </p>

        <h2 id="pack-install-vs-registry">pack install vs registry install?</h2>
        <p>
          <code>pack install</code> copies from the bundled catalog inside the npm package.{" "}
          <code>registry install</code> fetches metadata from the API and clones GitHub. For official packs
          both work; registry install is required for community packs.
        </p>

        <h2 id="skills">What are orkestrate and orkestrate-pack-author skills?</h2>
        <p>
          OpenCode skills shipped in bundled harness slices. <code>orkestrate</code> teaches the agent to
          run CLI commands for launch/list/stop. <code>orkestrate-pack-author</code> teaches pack layout and
          validate — included on <code>extension-builder</code>.
        </p>

        <h2 id="publish">How do I publish to the registry?</h2>
        <ol>
          <li>
            <code>orkestrate pack validate .</code>
          </li>
          <li>Push pack to a public GitHub repository.</li>
          <li>
            Submit at <Link href="/submit">/submit</Link> with GitHub sign-in.
          </li>
          <li>Wait for manual approval.</li>
        </ol>
        <p>
          See <Link href="/docs/publisher">Publisher guide</Link>. CLI submit is not available in v0.
        </p>

        <h2 id="pi">Does Pi or Claude Code work?</h2>
        <p>
          Not in v0. Only the OpenCode harness engine and adapter ship today. Additional drivers will add
          new <code>harnesses/&lt;engine&gt;/</code> directories without changing pack identity.
        </p>

        <h2 id="profile-word">Why do I still see “profile” in places?</h2>
        <p>
          Legacy naming from earlier prototypes. User-facing docs and registry kinds prefer <strong>pack</strong>.
          <code>orkestrate profile validate</code> remains as an alias.
        </p>

        <h2 id="monorepo">Can my pack live in a monorepo?</h2>
        <p>
          Yes. Registry manifest JSON should include <code>orkestrate.packPath</code> (e.g.{" "}
          <code>orkestrate/packs/coding</code>) and <code>ref</code> for the git ref to tarball.{" "}
          <code>source_url</code> points at the repo root.
        </p>

        <h2 id="bun-required">Why Bun?</h2>
        <p>
          The published CLI and OpenTUI workbench run on Bun. Install scripts ensure Bun is present. This is
          independent of which language your agent pack targets.
        </p>

        <h2 id="get-help">Still stuck?</h2>
        <p>
          <Link href="/docs/help/troubleshooting">Troubleshooting</Link> for launch/registry diagnostics.{" "}
          <a href="https://github.com/orkestrateai/orkestrate/issues">GitHub issues</a> for bugs and feature
          requests.
        </p>
      </div>
      <DocPrevNext href="/docs/help/common-issues" />
    </>
  );
}