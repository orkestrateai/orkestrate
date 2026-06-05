import DocHeader from "@/components/docs/doc-header";
import CodeBlock from "@/components/CodeBlock";
import DocPrevNext from "@/components/docs/prev-next";

export default function AgentPacksPage() {
  return (
    <>
      <DocHeader
        eyebrow="Agents"
        title="Agent packs"
        description="Installable, publishable agent products — not one-off chat sessions."
      />
      <div className="doc-prose">
        <h2 id="manifest">pack.yaml</h2>
        <CodeBlock
          lang="yaml"
          code={`id: coding
name: coding
description: General-purpose coding agent.
version: "0.1.0"
harness: opencode`}
        />

        <h2 id="create">Create from template</h2>
        <CodeBlock
          lang="bash"
          code={`orkestrate pack create my-agent --from coding
orkestrate pack validate my-agent`}
        />

        <h2 id="paths">Install paths</h2>
        <CodeBlock
          lang="text"
          code={`<workspace>/.orkestrate/packs/<id>/
~/.orkestrate/packs/<id>/          # --global`}
        />
      </div>
      <DocPrevNext href="/docs/agents/packs" />
    </>
  );
}