import DocHeader from "@/components/docs/doc-header";
import DocCard from "@/components/docs/doc-card";
import { DOC_CARDS } from "@/lib/docs-nav";
import DocPrevNext from "@/components/docs/prev-next";
import Link from "next/link";

export default function DocsHomePage() {
  return (
    <>
      <DocHeader
        eyebrow="Documentation"
        title="Orkestrate docs"
        description="Harness slices, agent packs, registry install, and launch."
        v0Note="OpenCode harness slices in packs today. More engines and agent-authored slices are on the roadmap."
      />
      <div className="mb-8 rounded-xl border border-default bg-card px-4 py-4 text-[14px] leading-relaxed text-muted">
        <p className="font-medium text-[var(--foreground)]">For AI assistants</p>
        <p className="mt-1">
          Point agents at{" "}
          <a href="/llms.txt" className="font-medium text-[var(--foreground)] underline decoration-[var(--border)] underline-offset-2 hover:decoration-[var(--foreground)]">
            llms.txt
          </a>{" "}
          (compact index) or{" "}
          <a href="/agents.md" className="font-medium text-[var(--foreground)] underline decoration-[var(--border)] underline-offset-2 hover:decoration-[var(--foreground)]">
            agents.md
          </a>{" "}
          (full CLI rules). Also in the published npm package as <code>AGENTS.md</code>.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {DOC_CARDS.map((card) => (
          <DocCard key={card.href} {...card} />
        ))}
      </div>
      <p className="mt-8 text-[14px] text-muted">
        <Link
          href="/resources"
          className="font-medium text-[var(--foreground)] underline decoration-[var(--border)] underline-offset-2 hover:decoration-[var(--foreground)]"
        >
          Resources
        </Link>{" "}
        — changelog, llms.txt, GitHub.
      </p>
      <DocPrevNext href="/docs" />
    </>
  );
}