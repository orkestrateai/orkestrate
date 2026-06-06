import DocHeader from "@/components/docs/doc-header";
import CodeBlock from "@/components/CodeBlock";
import Callout from "@/components/docs/callout";
import DocPrevNext from "@/components/docs/prev-next";
import Link from "next/link";

export default function HarnessAuthoringPage() {
  return (
    <>
      <DocHeader
        eyebrow="Harnesses"
        title="Authoring harness slices"
        description="Structure OpenCode harness files inside a pack, configure permissions and skills, validate, and understand launch-time sync."
      />
      <div className="doc-prose">
        <h2 id="layout">Directory layout</h2>
        <CodeBlock
          lang="text"
          code={`my-pack/
  pack.yaml
  info.md                          # optional human/agent readme
  harnesses/opencode/
    opencode.json                  # required — OpenCode config
    agents/
      my-agent.md                  # agent prompts (markdown + frontmatter)
    skills/
      my-skill/SKILL.md            # OpenCode skills
    plugins/                       # optional OpenCode plugins`}
        />

        <h2 id="pack-yaml">pack.yaml</h2>
        <p>Minimal manifest — engine binding and identity:</p>
        <CodeBlock
          lang="yaml"
          code={`id: my-pack
name: my-pack
description: What this agent is for.
version: "0.1.0"
harness: opencode`}
        />

        <h2 id="opencode-json">opencode.json</h2>
        <p>
          Native OpenCode configuration. Defines default agent, permissions, MCP servers, plugins, and
          instruction file globs. Example from the bundled <code>coding</code> pack:
        </p>
        <CodeBlock
          lang="json"
          filename="harnesses/opencode/opencode.json (excerpt)"
          code={`{
  "$schema": "https://opencode.ai/config.json",
  "default_agent": "coding",
  "share": "manual",
  "autoupdate": false,
  "instructions": ["AGENTS.md", "README.md"],
  "agent": {
    "coding": {
      "description": "General-purpose coding agent.",
      "mode": "primary",
      "permission": {
        "read": "allow",
        "grep": "allow",
        "bash": "allow",
        "edit": "allow",
        "write": "allow",
        "skill": { "orkestrate": "allow" }
      }
    }
  }
}`}
        />
        <p>
          Orchestrator or author packs should allow skills <code>orkestrate</code> and{" "}
          <code>orkestrate-pack-author</code> in <code>permission.skill</code> when those skills are
          shipped in the slice.
        </p>

        <h2 id="agents">Agent prompts</h2>
        <p>
          Markdown files under <code>agents/</code>. Referenced from <code>opencode.json</code>{" "}
          <code>agent</code> entries. Keep prompts focused on domain expertise and workflow — harness
          mechanics live in JSON and skills.
        </p>

        <h2 id="skills">Skills</h2>
        <p>
          Each skill is a folder with <code>SKILL.md</code> and YAML frontmatter (<code>name</code>,{" "}
          <code>description</code>, optional <code>compatibility</code>). OpenCode loads them at runtime in
          the launched terminal.
        </p>
        <ul>
          <li>
            <code>orkestrate</code> — list/install packs, <code>run launch|list|stop</code> from bash.
          </li>
          <li>
            <code>orkestrate-pack-author</code> — scaffold <code>pack.yaml</code>, validate, prepare for
            registry publish.
          </li>
        </ul>

        <h2 id="scaffold">Scaffold from a template</h2>
        <CodeBlock
          lang="bash"
          code={`orkestrate pack create my-pack --from coding
# or for authoring workflows:
orkestrate pack create my-pack --from extension-builder

orkestrate pack validate my-pack`}
        />
        <p>
          Templates copy harness layout from bundled packs. Workspace copies:{" "}
          <code>.orkestrate/packs/&lt;id&gt;/</code>. Add <code>--global</code> for{" "}
          <code>~/.orkestrate/packs/&lt;id&gt;/</code>.
        </p>

        <h2 id="validate">Validate</h2>
        <CodeBlock lang="bash" code="orkestrate pack validate my-pack" />
        <p>Checks include:</p>
        <ul>
          <li>
            <code>pack.yaml</code> present with required fields and matching <code>id</code>.
          </li>
          <li>
            Harness directory exists for declared engine (<code>harnesses/opencode/</code>).
          </li>
          <li>
            <code>opencode.json</code> parses and references agents where expected.
          </li>
        </ul>

        <h2 id="sync">Launch-time sync</h2>
        <p>
          On each <code>run launch</code>, the OpenCode driver copies the installed slice into the pack
          home:
        </p>
        <ul>
          <li>
            <strong>First launch</strong> — full slice copied into{" "}
            <code>.orkestrate/pack-homes/&lt;id&gt;/home/.config/opencode/</code> (and related XDG paths).
          </li>
          <li>
            <strong>Later launches</strong> — missing <code>agents/</code>, <code>skills/</code>, and{" "}
            <code>plugins/</code> files are added. Existing <code>opencode.json</code> in the pack home is{" "}
            <strong>never overwritten</strong> (workspace-specific tweaks persist).
          </li>
        </ul>
        <p>
          To customize a pack for one repo without changing the installed source, edit files under the pack
          home after first launch.
        </p>

        <h2 id="test">Test the slice</h2>
        <CodeBlock
          lang="bash"
          code={`orkestrate pack install my-pack    # if not already installed
orkestrate run launch my-pack`}
        />
        <p>
          OpenCode opens in a new window. Confirm permissions, skills, and agent behavior match intent.
        </p>

        <Callout kind="warning" title="No Orkestrate tool DSL">
          Harness slices use native OpenCode config only. Do not add custom Orkestrate-specific tool JSON —
          use OpenCode permissions, skills, and plugins.
        </Callout>

        <h2 id="publish">Publish</h2>
        <p>
          Push to a public GitHub repo, validate, then submit via{" "}
          <Link href="/submit">/submit</Link>. See <Link href="/docs/publisher">Publisher guide</Link> for
          manifest fields and review flow.
        </p>
      </div>
      <DocPrevNext href="/docs/harnesses/authoring" />
    </>
  );
}