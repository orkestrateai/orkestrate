import DocHeader from "@/components/docs/doc-header";
import CodeBlock from "@/components/CodeBlock";
import Link from "next/link";
import DocPrevNext from "@/components/docs/prev-next";

export default function RegistryDocsPage() {
  return (
    <>
      <DocHeader
        eyebrow="Registry"
        title="Browse and install"
        description="Public catalog at orkestrate.space. Bundled packs always available via API fallback."
      />
      <div className="doc-prose">
        <h2 id="cli">CLI</h2>
        <CodeBlock
          lang="bash"
          code={`orkestrate registry list
orkestrate registry search review
orkestrate registry install coding`}
        />

        <h2 id="api">API</h2>
        <p>
          <code>GET https://orkestrate.space/api/registry</code> — approved items with{" "}
          <code>manifest_json</code> (<code>orkestrate.ref</code>, <code>orkestrate.packPath</code> for
          monorepo packs).
        </p>
        <p>
          Override: <code>ORKESTRATE_REGISTRY_URL</code> for local dev.
        </p>

        <h2 id="publish">Publish</h2>
        <p>
          <Link href="/submit">Web submit</Link> (GitHub sign-in). CLI device submit is not wired yet.
        </p>
      </div>
      <DocPrevNext href="/docs/registry" />
    </>
  );
}