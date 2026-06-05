import DocHeader from "@/components/docs/doc-header";
import DocPrevNext from "@/components/docs/prev-next";

export default function CommonIssuesPage() {
  return (
    <>
      <DocHeader eyebrow="Help" title="Common issues" description="FAQ for installers, publishers, and launch." />
      <div className="doc-prose">
        <h2 id="difference-pack-harness">What is the difference between a pack and a harness?</h2>
        <p>
          The pack is the agent product (identity). The harness slice is task-specific execution config
          inside the pack.
        </p>

        <h2 id="touch-opencode">Does Orkestrate modify my OpenCode?</h2>
        <p>No. Only the child process and pack home receive pack config.</p>

        <h2 id="publish">How do I publish?</h2>
        <p>
          Validate locally, then submit at <a href="/submit">/submit</a> with GitHub and manifest JSON.
        </p>

        <h2 id="pi">Does Pi or Claude Code work?</h2>
        <p>Not in v0. OpenCode only until additional adapters ship.</p>
      </div>
      <DocPrevNext href="/docs/help/common-issues" />
    </>
  );
}