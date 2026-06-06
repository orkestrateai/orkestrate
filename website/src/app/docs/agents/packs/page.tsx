import DocHeader from "@/components/docs/doc-header";
import CodeBlock from "@/components/CodeBlock";
import Callout from "@/components/docs/callout";
import DocPrevNext from "@/components/docs/prev-next";
import Link from "next/link";

export default function AgentPacksPage() {
  return (
    <>
      <DocHeader
        eyebrow="Agents"
        title="Agent packs"
        description="Installable, publishable agent products — manifest, harness slice, install paths, and bundled templates."
      />
      <div className="doc-prose">
        <h2 id="what">What is a pack?</h2>
        <p>
          A pack is the unit of distribution in Orkestrate: agent identity plus a harness slice for a
          specific engine. Packs are not chat sessions — they are versioned artifacts you install once and
          launch many times, with persistent homes per repository.
        </p>

        <h2 id="manifest">pack.yaml</h2>
        <p>Required fields:</p>
        <ul>
          <li>
            <code>id</code> — lowercase slug; folder name and CLI argument.
          </li>
          <li>
            <code>name</code>, <code>description</code> — display and registry copy.
          </li>
          <li>
            <code>harness</code> — <code>opencode</code> in v0.
          </li>
          <li>
            <code>version</code> — semver string for registry rows.
          </li>
        </ul>
        <CodeBlock
          lang="yaml"
          code={`id: coding
name: coding
description: General-purpose coding agent for day-to-day software work.
version: "0.1.0"
harness: opencode`}
        />

        <h2 id="full-layout">Full pack layout</h2>
        <CodeBlock
          lang="text"
          code={`coding/
  pack.yaml
  harnesses/opencode/
    opencode.json
    agents/coding.md
    skills/orkestrate/SKILL.md`}
        />

        <h2 id="bundled">Bundled packs (ship in CLI)</h2>
        <table>
          <thead>
            <tr>
              <th>Slug</th>
              <th>Purpose</th>
              <th>Notable skills</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>coding</code>
              </td>
              <td>Day-to-day software work</td>
              <td>
                <code>orkestrate</code> (multi-pack launch)
              </td>
            </tr>
            <tr>
              <td>
                <code>extension-builder</code>
              </td>
              <td>Author packs, drivers, extensions</td>
              <td>
                <code>orkestrate</code>, <code>orkestrate-pack-author</code>
              </td>
            </tr>
          </tbody>
        </table>
        <CodeBlock
          lang="bash"
          code={`orkestrate pack install coding          # from bundle in npm package
orkestrate registry install extension-builder  # same packs via registry API`}
        />

        <h2 id="create">Create from template</h2>
        <CodeBlock
          lang="bash"
          code={`orkestrate pack create my-agent --from coding
orkestrate pack create my-author --from extension-builder --description "Custom author pack"
orkestrate pack validate my-agent`}
        />
        <p>
          <code>--from</code> accepts any installed or bundled template id. Optional{" "}
          <code>--global</code> writes to the user home instead of the current repo.
        </p>

        <h2 id="paths">Where packs live after install</h2>
        <CodeBlock
          lang="text"
          code={`# workspace (default for registry install / create)
<repo>/.orkestrate/packs/<id>/

# global (--global on install/create, welcome flow for coding)
~/.orkestrate/packs/<id>/`}
        />
        <p>
          <code>orkestrate pack list</code> shows what is visible from the current working directory
          (workspace + global resolution).
        </p>

        <h2 id="install-sources">Install sources</h2>
        <table>
          <thead>
            <tr>
              <th>Command</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>pack install &lt;slug&gt;</code>
              </td>
              <td>Bundled catalog inside npm package only</td>
            </tr>
            <tr>
              <td>
                <code>registry install &lt;slug&gt;</code>
              </td>
              <td>GitHub <code>source_url</code> + registry manifest paths</td>
            </tr>
            <tr>
              <td>
                <code>pack create &lt;id&gt;</code>
              </td>
              <td>Local scaffold from template</td>
            </tr>
          </tbody>
        </table>
        <p>
          Registry install flags: <code>--global</code>, <code>--overwrite</code> to replace an existing
          copy.
        </p>

        <h2 id="validate">Validate before publish</h2>
        <CodeBlock lang="bash" code="orkestrate pack validate my-agent" />
        <p>
          Fix reported layout errors before submitting to the registry. Web submit also expects a valid GitHub
          URL and manifest JSON.
        </p>

        <Callout kind="note" title="Legacy profile commands">
          <code>orkestrate profile validate</code> still aliases <code>pack validate</code>. Prefer{" "}
          <code>pack</code> in new docs and skills.
        </Callout>

        <h2 id="next">Related</h2>
        <ul>
          <li>
            <Link href="/docs/agents/launch">Launch & pack homes</Link>
          </li>
          <li>
            <Link href="/docs/harnesses/authoring">Authoring harness slices</Link>
          </li>
          <li>
            <Link href="/docs/registry">Registry</Link>
          </li>
        </ul>
      </div>
      <DocPrevNext href="/docs/agents/packs" />
    </>
  );
}