import DocHeader from "@/components/docs/doc-header";
import CodeBlock from "@/components/CodeBlock";
import DocPrevNext from "@/components/docs/prev-next";

export default function HarnessAuthoringPage() {
  return (
    <>
      <DocHeader
        eyebrow="Harnesses"
        title="Authoring harness slices"
        description="Structure OpenCode harness files inside a pack and validate before publish."
      />
      <div className="doc-prose">
        <h2 id="layout">Layout</h2>
        <CodeBlock
          lang="text"
          code={`my-pack/
  pack.yaml
  harnesses/opencode/
    opencode.json
    agents/
    skills/
    plugins/`}
        />

        <h2 id="validate">Validate</h2>
        <CodeBlock lang="bash" code="orkestrate pack validate my-pack" />

        <h2 id="sync">Launch sync</h2>
        <p>
          On launch, the OpenCode driver copies the slice into the pack home. Existing{" "}
          <code>opencode.json</code> in the home is not overwritten; new agents/skills/plugins are
          added if missing.
        </p>
      </div>
      <DocPrevNext href="/docs/harnesses/authoring" />
    </>
  );
}