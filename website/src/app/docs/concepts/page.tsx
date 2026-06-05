import DocHeader from "@/components/docs/doc-header";
import DocPrevNext from "@/components/docs/prev-next";

export default function ConceptsPage() {
  return (
    <>
      <DocHeader
        eyebrow="Get started"
        title="Concepts"
        description="Agent identity stays in the pack. The harness slice changes with the task."
      />
      <div className="doc-prose">
        <h2 id="agent-pack">Agent pack</h2>
        <p>
          A publishable agent product: <code>pack.yaml</code> plus <code>harnesses/opencode/</code>.
          Defines <em>who</em> — domain, prompts, skills.
        </p>

        <h2 id="harness-slice">Harness slice</h2>
        <p>
          How the agent runs <em>for this task</em> — tools, permissions, agents, plugins. Review and
          daily coding should not share one config.
        </p>

        <h2 id="engine">Engine</h2>
        <p>
          OpenCode executes the loop in v0. Orkestrate prepares the slice and launches it in a new
          terminal.
        </p>

        <h2 id="registry">Registry</h2>
        <p>
          Approved packs with GitHub <code>source_url</code>. Web browse; CLI{" "}
          <code>orkestrate registry install &lt;slug&gt;</code>.
        </p>
      </div>
      <DocPrevNext href="/docs/concepts" />
    </>
  );
}