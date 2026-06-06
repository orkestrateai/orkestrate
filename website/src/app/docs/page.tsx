import DocHeader from "@/components/docs/doc-header";
import DocCard from "@/components/docs/doc-card";
import Callout from "@/components/docs/callout";
import { DOC_CARDS } from "@/lib/docs-nav";
import DocPrevNext from "@/components/docs/prev-next";
import { contributingUrl, docsIssuesUrl, docsTreeUrl } from "@/lib/docs-github";
import Link from "next/link";

export default function DocsHomePage() {
  return (
    <>
      <DocHeader
        eyebrow="Documentation"
        title="Orkestrate docs"
        description="Install the CLI, run specialized harness slices on OpenCode, author agent packs, and publish to the registry."
        v0Note="OpenCode harness slices in packs today. More engines and agent-authored slices are on the roadmap."
      />

      <Callout kind="tip" title="Help us make these docs proper">
        <p>
          orkestrate.space docs are open source in{" "}
          <a href={docsTreeUrl} target="_blank" rel="noopener noreferrer">
            <code>website/src/app/docs/</code>
          </a>{" "}
          on GitHub. They were written quickly for launch — we still need clearer tutorials, more examples,
          CLI parity checks, and coverage for Windows edge cases. PRs and issue reports are welcome.
        </p>
      </Callout>

      <div className="doc-prose mb-10">
        <h2 id="what">What Orkestrate is</h2>
        <p>
          Orkestrate is the layer to <strong>browse</strong>, <strong>use</strong>, and{" "}
          <strong>share</strong> specialized harnesses for agent packs. You install packs, launch OpenCode in
          a <strong>new terminal</strong> with an isolated pack home, and keep sessions per agent per
          repository — without overwriting your personal OpenCode configuration.
        </p>

        <h2 id="paths">Learning paths</h2>
        <h3 id="path-user">I want to use packs</h3>
        <ol>
          <li>
            <Link href="/docs/getting-started/installation">Installation</Link>
          </li>
          <li>
            <Link href="/docs/getting-started/quickstart">Quickstart</Link>
          </li>
          <li>
            <Link href="/docs/workbench">Workbench (TUI)</Link>
          </li>
          <li>
            <Link href="/registry">Registry</Link> — install more packs
          </li>
        </ol>

        <h3 id="path-author">I want to author packs</h3>
        <ol>
          <li>
            <Link href="/docs/concepts">Concepts</Link> — pack vs harness slice
          </li>
          <li>
            Install <code>extension-builder</code> →{" "}
            <Link href="/docs/agents/packs">Agent packs</Link>
          </li>
          <li>
            <Link href="/docs/harnesses/authoring">Authoring harness slices</Link>
          </li>
          <li>
            <Link href="/docs/publisher">Publisher guide</Link> → <Link href="/submit">Submit</Link>
          </li>
        </ol>

        <h3 id="path-integrator">I want to integrate (API / CI)</h3>
        <ol>
          <li>
            <Link href="/docs/registry">Registry</Link> — API shape and env vars
          </li>
          <li>
            <Link href="/docs/reference/cli">CLI reference</Link>
          </li>
          <li>
            <a href="/llms.txt">llms.txt</a> / <a href="/agents.md">agents.md</a> for coding agents
          </li>
        </ol>

        <h2 id="agents-ai">For AI assistants</h2>
        <p>
          Point tools at{" "}
          <a href="/llms.txt" className="font-medium text-[var(--foreground)] underline decoration-[var(--border)] underline-offset-2 hover:decoration-[var(--foreground)]">
            llms.txt
          </a>{" "}
          (compact index) or{" "}
          <a href="/agents.md" className="font-medium text-[var(--foreground)] underline decoration-[var(--border)] underline-offset-2 hover:decoration-[var(--foreground)]">
            agents.md
          </a>{" "}
          (full CLI rules). The npm package also ships <code>AGENTS.md</code>.
        </p>

        <h2 id="contribute">Contribute to the docs</h2>
        <p>
          The site docs are the canonical reference for orkestrate.space. CLI markdown under{" "}
          <code>orkestrate/docs/</code> covers pack authoring for repo contributors; when the two disagree,
          fix the website page and open a PR.
        </p>
        <ol>
          <li>
            Find the page source under{" "}
            <a href={docsTreeUrl} target="_blank" rel="noopener noreferrer">
              <code>website/src/app/docs/</code>
            </a>{" "}
            (each route is a <code>page.tsx</code> file).
          </li>
          <li>
            Use <strong>Edit this page</strong> at the top of any doc, or fork and branch locally with{" "}
            <code>bun run build</code> in <code>website/</code> before opening a PR.
          </li>
          <li>
            Read{" "}
            <a href={contributingUrl} target="_blank" rel="noopener noreferrer">
              CONTRIBUTING.md
            </a>{" "}
            for repo layout and review expectations.
          </li>
        </ol>
        <p>
          Not ready for a PR?{" "}
          <a href={docsIssuesUrl} target="_blank" rel="noopener noreferrer">
            Open a docs issue
          </a>{" "}
          with what confused you or what is missing.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {DOC_CARDS.map((card) => (
          <DocCard key={card.href} {...card} />
        ))}
      </div>

      <p className="mt-8 text-[14px] text-muted">
        <Link
          href="/resources"
          className="font-medium text-[var(--foreground)] underline decoration-[var(--border)] underline-offset-2 hover:decoration-[var(--foreground)]"
        >
          Resources
        </Link>{" "}
        — changelog, llms.txt, GitHub.
      </p>
      <DocPrevNext href="/docs" />
    </>
  );
}