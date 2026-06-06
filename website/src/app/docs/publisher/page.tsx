import DocHeader from "@/components/docs/doc-header";
import CodeBlock from "@/components/CodeBlock";
import Callout from "@/components/docs/callout";
import DocPrevNext from "@/components/docs/prev-next";
import Link from "next/link";

export default function PublisherDocsPage() {
  return (
    <>
      <DocHeader
        eyebrow="Registry"
        title="Publisher guide"
        description="Package agent packs for the public registry — GitHub layout, manifest JSON, validation, and the manual review flow."
      />
      <div className="doc-prose">
        <h2 id="model">Distribution model</h2>
        <p>
          Orkestrate does not host pack source code. The registry stores approved metadata plus a GitHub{" "}
          <code>source_url</code>. When a user runs{" "}
          <code>orkestrate registry install &lt;slug&gt;</code>, the CLI clones that repository (or
          tarball) and copies the pack path declared in the manifest.
        </p>

        <h2 id="pack-layout">Required pack layout</h2>
        <CodeBlock
          lang="text"
          code={`my-pack/
  pack.yaml
  harnesses/opencode/
    opencode.json
    agents/
    skills/`}
        />
        <CodeBlock
          lang="yaml"
          filename="pack.yaml"
          code={`id: my-pack
name: my-pack
description: What this agent does.
version: "0.1.0"
harness: opencode`}
        />

        <h2 id="monorepo">Monorepo packs</h2>
        <p>
          Official packs in <code>orkestrateai/orkestrate</code> live under{" "}
          <code>orkestrate/packs/&lt;slug&gt;/</code>. Registry manifest JSON must include:
        </p>
        <CodeBlock
          lang="json"
          code={`{
  "id": "my-pack",
  "name": "my-pack",
  "description": "...",
  "harness": "opencode",
  "version": "0.1.0",
  "orkestrate": {
    "ref": "main",
    "packPath": "path/to/my-pack"
  }
}`}
        />
        <p>
          <code>source_url</code> on submit is the <strong>repository root</strong>;{" "}
          <code>packPath</code> is relative to that root.
        </p>

        <h2 id="kinds">Registry kinds (v0)</h2>
        <table>
          <thead>
            <tr>
              <th>Kind</th>
              <th>Ships today</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>pack</code>
              </td>
              <td>Yes</td>
              <td>Primary — <code>pack.yaml</code> + OpenCode harness slice.</td>
            </tr>
            <tr>
              <td>
                <code>adapter</code>
              </td>
              <td>Review case-by-case</td>
              <td>
                Harness drivers under <code>extensions/</code>; validate with{" "}
                <code>extension validate</code>.
              </td>
            </tr>
            <tr>
              <td>
                <code>profile-pack</code>
              </td>
              <td>Legacy label</td>
              <td>Prefer <code>pack</code> for new submissions.</td>
            </tr>
          </tbody>
        </table>

        <h2 id="validate">Validate locally</h2>
        <CodeBlock
          lang="bash"
          code={`orkestrate pack validate .
# or from repo root with path:
orkestrate pack validate my-pack`}
        />
        <p>
          For extension drivers: <code>orkestrate extension validate ./extensions/my-adapter</code>
        </p>

        <h2 id="github">GitHub requirements</h2>
        <ul>
          <li>Public repository (or accessible to reviewers for private beta).</li>
          <li>
            <code>pack.yaml</code> at the submitted pack path.
          </li>
          <li>Default branch contains the version you want listed.</li>
        </ul>

        <h2 id="submit">Submit for review</h2>
        <ol>
          <li>
            Sign in at <Link href="/submit">/submit</Link> with GitHub.
          </li>
          <li>
            Paste your public GitHub repo URL (or pack folder URL). Orkestrate fetches{" "}
            <code>pack.yaml</code> automatically.
          </li>
          <li>Confirm slug, version, and description — one click to submit.</li>
          <li>Submission stays <code>pending</code> until manual approval.</li>
          <li>Approved rows appear on <Link href="/registry">/registry</Link> and in the API.</li>
        </ol>
        <p>
          Monorepo packs: expand <strong>Monorepo options</strong> on the submit form and set pack path (e.g.{" "}
          <code>orkestrate/packs/coding</code>) and branch.
        </p>
        <Callout kind="note" title="No CLI submit in v0">
          <code>orkestrate pack submit</code> is not wired. Web submit is the supported path.
        </Callout>

        <h2 id="review">What reviewers check</h2>
        <ul>
          <li>Manifest matches repo layout and slug is unique.</li>
          <li>
            <code>pack validate</code> passes on the tagged path.
          </li>
          <li>Description and permissions are appropriate for a public catalog.</li>
          <li>No misleading or broken <code>source_url</code>.</li>
        </ul>

        <h2 id="after">After approval</h2>
        <p>Users install with:</p>
        <CodeBlock lang="bash" code="orkestrate registry install <your-slug>" />
        <p>
          Document install commands in your repo README. Link back to your registry detail page when live.
        </p>

        <div className="mt-8">
          <Link
            href="/submit"
            className="inline-flex h-9 items-center rounded-full border border-default bg-card px-5 text-[13px] font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--card-hover)]"
          >
            Submit to registry →
          </Link>
        </div>
      </div>
      <DocPrevNext href="/docs/publisher" />
    </>
  );
}