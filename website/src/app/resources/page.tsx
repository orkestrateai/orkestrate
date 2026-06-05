import Header from "@/components/header";
import Footer from "@/components/footer";
import DocHeader from "@/components/docs/doc-header";
import Link from "next/link";

export default function ResourcesPage() {
  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <Header />
      <main className="mx-auto w-full max-w-[720px] flex-1 px-6 py-12">
        <DocHeader
          title="Resources"
          description="Docs, registry, and machine-readable guides for coding agents."
        />
        <div className="doc-prose">
          <h2 id="agents">For AI assistants</h2>
          <p>
            Orkestrate ships two entry points so agents know what exists and what not to invent:
          </p>
          <ul>
            <li>
              <a href="/llms.txt" target="_blank" rel="noopener noreferrer">
                llms.txt
              </a>{" "}
              — short index, install one-liner, CLI list, doc links (common convention for LLM crawlers).
            </li>
            <li>
              <a href="/agents.md" target="_blank" rel="noopener noreferrer">
                agents.md
              </a>{" "}
              — fuller rules: terminology, commands, paths, v0 limits.
            </li>
          </ul>
          <p>
            The npm package includes the same content as <code>AGENTS.md</code> at the package root.
            Add to your repo: <code>curl -s https://orkestrate.space/agents.md</code> or link{" "}
            <code>https://orkestrate.space/llms.txt</code> in tool docs.
          </p>

          <h2 id="links">Links</h2>
          <ul>
            <li>
              <Link href="/docs">Documentation</Link>
            </li>
            <li>
              <Link href="/registry">Registry</Link>
            </li>
            <li>
              <a href="https://github.com/orkestrateai/orkestrate" target="_blank" rel="noopener noreferrer">
                GitHub
              </a>
            </li>
            <li>
              <Link href="/changelog">Changelog</Link>
            </li>
          </ul>
        </div>
      </main>
      <Footer />
    </div>
  );
}