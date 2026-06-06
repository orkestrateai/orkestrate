import DocHeader from "@/components/docs/doc-header";
import CodeBlock from "@/components/CodeBlock";
import Callout from "@/components/docs/callout";
import DocPrevNext from "@/components/docs/prev-next";
import Link from "next/link";

export default function ConceptsPage() {
  return (
    <>
      <DocHeader
        eyebrow="Get started"
        title="Concepts"
        description="How Orkestrate separates agent identity from task-specific execution — and what actually runs where."
        v0Note="OpenCode is the only harness engine today. Pi, Claude Code, and Codex adapters are on the roadmap."
      />
      <div className="doc-prose">
        <h2 id="mental-model">Mental model</h2>
        <p>
          Orkestrate is not a chat app and not a replacement for OpenCode. It is the layer where
          specialized harnesses are <strong>browsed</strong>, <strong>installed</strong>,{" "}
          <strong>launched</strong>, and <strong>published</strong>. You keep one agent identity per
          pack; you change the harness slice when the job changes.
        </p>
        <CodeBlock
          lang="text"
          code={`agent pack      = who  (identity, expertise, publishable product)
harness slice   = how  (tools, prompts, skills, policy for this task)
Orkestrate      = browse · use · share harnesses; bind agents to the right slice
OpenCode (v0)   = runtime loop that executes the slice in a new terminal`}
        />

        <h2 id="why-slices">Why one harness does not fit all work</h2>
        <p>
          A single OpenCode config forces the same tools, permissions, and prompts on unrelated jobs.
          Code review needs tight read access and different skills than greenfield feature work. Research
          packs need citation discipline; infra packs need guarded shell access. Orkestrate treats each
          task envelope as a first-class artifact inside the pack — a <strong>harness slice</strong> —
          instead of mutating your personal OpenCode install every time the task changes.
        </p>

        <h2 id="agent-pack">Agent pack</h2>
        <p>
          A pack is an installable, publishable agent product. At minimum it contains{" "}
          <code>pack.yaml</code> (identity and harness engine) plus a native harness directory — today{" "}
          <code>harnesses/opencode/</code>.
        </p>
        <ul>
          <li>
            <strong>Identity</strong> — <code>id</code>, <code>name</code>, <code>description</code>,{" "}
            <code>version</code>.
          </li>
          <li>
            <strong>Engine binding</strong> — <code>harness: opencode</code> selects the OpenCode driver.
          </li>
          <li>
            <strong>Distribution</strong> — packs can ship in the CLI bundle, install from the registry,
            or live in your repo under <code>.orkestrate/packs/</code>.
          </li>
        </ul>
        <CodeBlock
          lang="yaml"
          filename="pack.yaml"
          code={`id: coding
name: coding
description: General-purpose coding agent for day-to-day software work.
version: "0.1.0"
harness: opencode`}
        />

        <h2 id="harness-slice">Harness slice</h2>
        <p>
          The slice is task-specific execution config: OpenCode JSON, agent prompts, skills, plugins. It
          lives under <code>harnesses/opencode/</code> and is what gets synced into an isolated{" "}
          <strong>pack home</strong> on launch.
        </p>
        <CodeBlock
          lang="text"
          code={`harnesses/opencode/
  opencode.json       # permissions, default agent, MCP, plugins
  agents/*.md         # agent system prompts
  skills/*/SKILL.md   # OpenCode skills (YAML frontmatter)
  plugins/            # optional OpenCode plugins`}
        />
        <p>
          v0 ships one primary slice per pack in practice, but the layout supports multiple agents and
          skills inside the same slice. Roadmap: multiple named slices per pack and agent-proposed slices
          for the current job.
        </p>

        <h2 id="engine">Harness engine (OpenCode in v0)</h2>
        <p>
          Orkestrate does not embed the agent loop. The OpenCode adapter (<code>extensions/opencode-adapter/</code>)
          prepares environment variables, syncs the slice into the pack home, and spawns{" "}
          <code>opencode</code> in a <strong>new terminal window</strong>. Your normal OpenCode install
          and config directory are untouched.
        </p>

        <h2 id="workbench">Workbench vs agent session</h2>
        <table>
          <thead>
            <tr>
              <th>Surface</th>
              <th>Runs where</th>
              <th>Purpose</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>orkestrate</code> (no args)
              </td>
              <td>Current terminal — OpenTUI</td>
              <td>Install packs, browse catalog, launch, stop, see run status</td>
            </tr>
            <tr>
              <td>OpenCode after launch</td>
              <td>New terminal window</td>
              <td>Agent conversation, tools, edits, skills</td>
            </tr>
          </tbody>
        </table>
        <p>
          See <Link href="/docs/workbench">Workbench (TUI)</Link> for keys and screens.
        </p>

        <h2 id="pack-home">Pack home and session persistence</h2>
        <p>
          Each pack in each repo gets an isolated home under{" "}
          <code>.orkestrate/pack-homes/&lt;pack-id&gt;/home/</code>. OpenCode session data, synced config,
          and XDG paths for that pack live here. Relaunching the same pack in the same repo continues
          the same session context — without polluting <code>~/.config/opencode</code>.
        </p>
        <CodeBlock
          lang="text"
          code={`<workspace>/
  .orkestrate/
    packs/<id>/              # installed pack source (from bundle/registry/local)
    pack-homes/<id>/home/    # OpenCode runtime home for this pack in this repo
    runs/<run-id>/           # launch metadata (pid, state, timestamps)`}
        />

        <h2 id="runs">Runs</h2>
        <p>
          Every launch creates a <strong>run record</strong> under <code>.orkestrate/runs/</code>. The
          workbench shows <code>idle</code> or <code>running</code> per pack row. Runs are bookkeeping
          for terminals and processes — not a second copy of agent chat history.
        </p>

        <h2 id="registry">Registry</h2>
        <p>
          The public catalog at <Link href="/registry">orkestrate.space/registry</Link> lists approved
          packs. The CLI calls <code>GET /api/registry</code> and installs from each entry&apos;s{" "}
          <code>source_url</code> (GitHub) plus <code>manifest_json.orkestrate.ref</code> and{" "}
          <code>packPath</code> for monorepo layouts.
        </p>
        <CodeBlock
          lang="bash"
          code={`orkestrate registry list
orkestrate registry search coding
orkestrate registry install extension-builder`}
        />
        <p>
          Official bundled packs (<code>coding</code>, <code>extension-builder</code>) ship inside the
          npm package and are always available even when the API is unreachable.
        </p>

        <h2 id="skills">Skills inside packs</h2>
        <p>
          OpenCode skills are markdown files with YAML frontmatter in{" "}
          <code>harnesses/opencode/skills/</code>. Bundled examples:
        </p>
        <ul>
          <li>
            <code>orkestrate</code> — runtime control room (launch other packs, list/stop runs).
          </li>
          <li>
            <code>orkestrate-pack-author</code> — scaffold and validate packs (on{" "}
            <code>extension-builder</code>).
          </li>
        </ul>
        <p>
          Skills are loaded by OpenCode inside the launched terminal, not by the Orkestrate workbench.
        </p>

        <h2 id="terminology">Terminology</h2>
        <table>
          <thead>
            <tr>
              <th>Use</th>
              <th>Avoid in user-facing copy</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Pack / agent pack</td>
              <td>Profile (legacy CLI alias only)</td>
            </tr>
            <tr>
              <td>Harness slice</td>
              <td>“Master harness,” generic “config”</td>
            </tr>
            <tr>
              <td>Extension (driver)</td>
              <td>Adapter as a product line name</td>
            </tr>
            <tr>
              <td>Browse · use · share</td>
              <td>“Agent OS,” OpenCode-only marketing</td>
            </tr>
          </tbody>
        </table>

        <h2 id="not-shipped">Not in v0</h2>
        <ul>
          <li>Agent-authored harness slices at runtime (user-authored slices in packs only).</li>
          <li>Pi, Claude Code, or Codex harness engines.</li>
          <li>Embedded agent chat inside the Orkestrate TUI.</li>
          <li>CLI registry submit (use the <Link href="/submit">web submit flow</Link>).</li>
          <li>Multi-agent orchestration UI or handoff between packs in one surface.</li>
        </ul>

        <Callout kind="tip" title="Next reads">
          <Link href="/docs/getting-started/quickstart">Quickstart</Link> for hands-on flow,{" "}
          <Link href="/docs/agents/packs">Agent packs</Link> for layout and validate,{" "}
          <Link href="/docs/harnesses/introduction">Specialized harnesses</Link> for slice philosophy.
        </Callout>
      </div>
      <DocPrevNext href="/docs/concepts" />
    </>
  );
}