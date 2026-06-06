import DocHeader from "@/components/docs/doc-header";
import CodeBlock from "@/components/CodeBlock";
import Callout from "@/components/docs/callout";
import DocPrevNext from "@/components/docs/prev-next";
import Link from "next/link";

export default function HarnessIntroPage() {
  return (
    <>
      <DocHeader
        eyebrow="Harnesses"
        title="Specialized harnesses"
        description="Why task-specific harness slices exist, how they differ from agent identity, and how OpenCode executes them in v0."
      />
      <div className="doc-prose">
        <h2 id="problem">The problem with one config for everything</h2>
        <p>
          Most agent setups reuse a single OpenCode (or IDE) configuration for every task. That means the
          same tool permissions, skills, and system prompts for code review, greenfield features, research,
          and ops runbooks. In practice those jobs need different guardrails:
        </p>
        <ul>
          <li>
            <strong>Review</strong> — read-heavy, minimal write, no drive-by refactors.
          </li>
          <li>
            <strong>Daily coding</strong> — edit/write/bash with project conventions.
          </li>
          <li>
            <strong>Pack authoring</strong> — validate layout, scaffold harness files, registry metadata.
          </li>
          <li>
            <strong>Research</strong> — web/fetch tools, citation skills, no repo writes.
          </li>
        </ul>
        <p>
          Orkestrate&apos;s answer is not a bigger universal prompt — it is <strong>specialized harness
          slices</strong> versioned inside agent packs, selected and launched per job.
        </p>

        <h2 id="slice">What a harness slice is</h2>
        <p>
          A slice is the <em>how</em> for a task: native OpenCode configuration under{" "}
          <code>harnesses/opencode/</code>. It is not a fork of OpenCode and not a second runtime inside
          Orkestrate.
        </p>
        <CodeBlock
          lang="text"
          code={`pack.yaml                    # declares harness: opencode
harnesses/opencode/
  opencode.json              # agents, permissions, MCP, plugins
  agents/coding.md           # primary agent prompt
  skills/orkestrate/SKILL.md # optional OpenCode skills`}
        />
        <p>
          The bundled <code>coding</code> pack enables the <code>orkestrate</code> skill in permissions so
          the agent can spawn other packs in new terminals. The <code>extension-builder</code> pack adds{" "}
          <code>orkestrate-pack-author</code> for scaffolding new packs.
        </p>

        <h2 id="vs-pack">Slice vs pack</h2>
        <table>
          <thead>
            <tr>
              <th>Artifact</th>
              <th>Question it answers</th>
              <th>Example</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Agent pack</td>
              <td>Who is this agent?</td>
              <td>
                <code>extension-builder</code> — meta author for Orkestrate ecosystem work
              </td>
            </tr>
            <tr>
              <td>Harness slice</td>
              <td>How does it run for this task?</td>
              <td>
                OpenCode JSON + agents + skills under <code>harnesses/opencode/</code>
              </td>
            </tr>
          </tbody>
        </table>

        <h2 id="lifecycle">Lifecycle: install → sync → launch</h2>
        <ol>
          <li>
            <strong>Install</strong> — pack lands in <code>.orkestrate/packs/&lt;id&gt;/</code> (bundled,
            registry, or local scaffold).
          </li>
          <li>
            <strong>Launch</strong> — OpenCode driver copies slice files into{" "}
            <code>.orkestrate/pack-homes/&lt;id&gt;/home/</code> (see sync rules in{" "}
            <Link href="/docs/harnesses/authoring">Authoring</Link>).
          </li>
          <li>
            <strong>Execute</strong> — new terminal runs <code>opencode</code> with hijacked XDG paths
            pointing at the pack home.
          </li>
          <li>
            <strong>Persist</strong> — relaunch in the same repo continues OpenCode session data in that
            home.
          </li>
        </ol>

        <h2 id="craft">Who authors slices</h2>
        <ul>
          <li>
            <strong>Builders (today)</strong> — edit files in git, <code>pack validate</code>, publish via{" "}
            <Link href="/submit">registry submit</Link>.
          </li>
          <li>
            <strong>Agents (roadmap)</strong> — propose or generate a slice for the current task, then
            launch it without hand-editing JSON for every job.
          </li>
        </ul>

        <h2 id="engines">Engines</h2>
        <p>
          v0 ships the <strong>OpenCode adapter</strong> only (<code>extensions/opencode-adapter/</code>).
          Additional harness engines (Pi, Claude Code, Codex) will use the same pack manifest with
          different <code>harnesses/&lt;engine&gt;/</code> directories and matching drivers.
        </p>

        <Callout kind="note" title="Not a new runtime">
          Slices are configuration and capability envelopes. OpenCode still runs the tool loop; Orkestrate
          prepares the environment and launches it in isolation from your personal config.
        </Callout>

        <h2 id="next">Next</h2>
        <ul>
          <li>
            <Link href="/docs/harnesses/authoring">Authoring harness slices</Link> — file-by-file guide
          </li>
          <li>
            <Link href="/docs/agents/packs">Agent packs</Link> — <code>pack.yaml</code> and install paths
          </li>
          <li>
            <Link href="/docs/concepts">Concepts</Link> — full mental model
          </li>
        </ul>
      </div>
      <DocPrevNext href="/docs/harnesses/introduction" />
    </>
  );
}