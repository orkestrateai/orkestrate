import DocHeader from "@/components/docs/doc-header";
import CodeBlock from "@/components/CodeBlock";
import Callout from "@/components/docs/callout";
import DocPrevNext from "@/components/docs/prev-next";

export default function LaunchPage() {
  return (
    <>
      <DocHeader
        eyebrow="Agents"
        title="Launch and pack homes"
        description="New terminal per launch. Isolated OpenCode data per pack — your daily install stays separate."
      />
      <div className="doc-prose">
        <h2 id="model">Launch</h2>
        <p>
          Spawns a <strong>new terminal</strong> with the pack harness slice. The TUI does not embed
          the agent session.
        </p>

        <h2 id="home">Pack home</h2>
        <CodeBlock
          lang="text"
          code={`<workspace>/.orkestrate/pack-homes/<pack-id>/home/`}
        />
        <p>Sessions for that pack in that repo persist across launches.</p>

        <h2 id="runs">Run metadata</h2>
        <p>
          <code>.orkestrate/runs/&lt;run-id&gt;/</code> — launch records only. Pack rows show{" "}
          <strong>idle</strong> or <strong>running</strong>.
        </p>

        <Callout kind="warning" title="Windows">
          Requires Windows Terminal (<code>wt</code> on PATH). See troubleshooting if launch fails.
        </Callout>
      </div>
      <DocPrevNext href="/docs/agents/launch" />
    </>
  );
}