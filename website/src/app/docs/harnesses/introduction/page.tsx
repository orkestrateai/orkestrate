import DocHeader from "@/components/docs/doc-header";
import Callout from "@/components/docs/callout";
import DocPrevNext from "@/components/docs/prev-next";

export default function HarnessIntroPage() {
  return (
    <>
      <DocHeader
        eyebrow="Harnesses"
        title="Specialized harnesses"
        description="One runtime config cannot fit every task. Slices are first-class artifacts in each pack."
      />
      <div className="doc-prose">
        <h2 id="problem">Why slices</h2>
        <p>
          One OpenCode profile for everything forces the same tools and policy on unrelated work.
          PR review and greenfield coding are different jobs.
        </p>

        <h2 id="slice">What a slice is</h2>
        <p>
          Task-specific files under <code>harnesses/opencode/</code>: config, agents, skills, plugins.
          v0 ships one primary slice per pack; multiple slices per pack are supported in layout.
        </p>

        <h2 id="craft">Who authors them</h2>
        <ul>
          <li><strong>Builders</strong> — version in git, publish to the registry.</li>
          <li><strong>Agents</strong> (roadmap) — propose a slice for the current task.</li>
        </ul>

        <Callout kind="note" title="Not a new runtime">
          Slices are configuration and capability — not a fork of OpenCode.
        </Callout>
      </div>
      <DocPrevNext href="/docs/harnesses/introduction" />
    </>
  );
}