import DocHeader from "@/components/docs/doc-header";
import CodeBlock from "@/components/CodeBlock";
import Callout from "@/components/docs/callout";
import Link from "next/link";
import DocPrevNext from "@/components/docs/prev-next";

export default function RegistryDocsPage() {
  return (
    <>
      <DocHeader
        eyebrow="Registry"
        title="Browse and install"
        description="Public catalog, registry API, GitHub-backed install, and how bundled packs merge with approved submissions."
      />
      <div className="doc-prose">
        <h2 id="overview">Overview</h2>
        <p>
          The registry at <Link href="/registry">orkestrate.space/registry</Link> is the discovery surface
          for agent packs. The CLI installs approved entries by cloning GitHub <code>source_url</code> and
          resolving pack paths inside monorepos via manifest metadata.
        </p>
        <p>
          <strong>Browsing</strong> requires no account. <strong>Publishing</strong> uses GitHub sign-in at{" "}
          <Link href="/submit">Publish a pack</Link> (manual review before approval).
        </p>

        <h2 id="cli">CLI commands</h2>
        <CodeBlock
          lang="bash"
          code={`orkestrate registry list
orkestrate registry search review
orkestrate registry install coding
orkestrate registry install extension-builder --global
orkestrate registry install my-pack --overwrite`}
        />
        <table>
          <thead>
            <tr>
              <th>Flag</th>
              <th>Effect</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>--global</code>
              </td>
              <td>
                Install to <code>~/.orkestrate/packs/</code> instead of workspace.
              </td>
            </tr>
            <tr>
              <td>
                <code>--overwrite</code>
              </td>
              <td>Replace existing install of the same slug.</td>
            </tr>
          </tbody>
        </table>

        <h2 id="bundled">Bundled vs registry catalog</h2>
        <p>
          The npm package embeds <code>coding</code> and <code>extension-builder</code>. The registry API
          always exposes these official slugs from bundled definitions (correct monorepo{" "}
          <code>source_url</code>) even when Supabase rows exist. Community packs appear when approved in
          the database.
        </p>
        <p>
          <code>orkestrate pack install &lt;slug&gt;</code> installs bundled copies only.{" "}
          <code>registry install</code> uses the API + GitHub clone path.
        </p>

        <h2 id="api">HTTP API</h2>
        <CodeBlock
          lang="bash"
          code="curl -s https://orkestrate.space/api/registry | jq ."
        />
        <p>Each item includes:</p>
        <ul>
          <li>
            <code>slug</code>, <code>kind</code> (<code>pack</code>, etc.), <code>name</code>,{" "}
            <code>description</code>
          </li>
          <li>
            <code>source_url</code> — GitHub repo root for clone
          </li>
          <li>
            <code>version</code> — latest approved version string
          </li>
          <li>
            <code>manifest_json</code> — install hints, often including:
          </li>
        </ul>
        <CodeBlock
          lang="json"
          filename="manifest_json.orkestrate (monorepo packs)"
          code={`{
  "orkestrate": {
    "ref": "main",
    "packPath": "orkestrate/packs/coding"
  }
}`}
        />
        <p>
          CLI install resolves <code>packPath</code> and expects <code>pack.yaml</code> at that path in the
          cloned tarball.
        </p>

        <h2 id="env">Environment overrides</h2>
        <table>
          <thead>
            <tr>
              <th>Variable</th>
              <th>Used by</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>ORKESTRATE_REGISTRY_URL</code>
              </td>
              <td>CLI — default <code>https://orkestrate.space/api/registry</code></td>
            </tr>
            <tr>
              <td>
                <code>ORKESTRATE_BUNDLED_REPO_URL</code>
              </td>
              <td>Website API — GitHub URL in bundled pack responses</td>
            </tr>
            <tr>
              <td>
                <code>NEXT_PUBLIC_ORKESTRATE_REPO_URL</code>
              </td>
              <td>Website API — client-visible bundled repo URL</td>
            </tr>
          </tbody>
        </table>

        <h2 id="offline">Offline / API down</h2>
        <p>
          Bundled catalog in the CLI still works: <code>pack install coding</code>, workbench browse shows
          bundled rows without <code>[registry]</code> tag when API is unreachable.
        </p>

        <h2 id="publish">Publish a pack</h2>
        <ol>
          <li>
            <code>orkestrate pack validate .</code> in your repo.
          </li>
          <li>
            Push to public GitHub.
          </li>
          <li>
            Sign in at <Link href="/submit">Publish a pack</Link> with GitHub.
          </li>
          <li>
            Submit repo URL + manifest JSON; wait for manual approval.
          </li>
        </ol>
        <p>
          CLI <code>pack submit</code> is not wired in v0. See{" "}
          <Link href="/docs/publisher">Publisher guide</Link>.
        </p>

        <Callout kind="note" title="Review">
          All submissions are manually reviewed. Approved rows become visible on the website and API.
        </Callout>
      </div>
      <DocPrevNext href="/docs/registry" />
    </>
  );
}