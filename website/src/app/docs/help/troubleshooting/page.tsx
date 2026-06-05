import DocHeader from "@/components/docs/doc-header";
import DocPrevNext from "@/components/docs/prev-next";

export default function TroubleshootingPage() {
  return (
    <>
      <DocHeader eyebrow="Help" title="Troubleshooting" description="Common fixes for launch, registry, and platform issues." />
      <div className="doc-prose">
        <h2 id="launch-windows">Launch fails on Windows (0x80070002)</h2>
        <p>Install Windows Terminal and ensure <code>wt</code> is on PATH. Run <code>orkestrate doctor</code>.</p>

        <h2 id="stale-running">Pack stuck on running</h2>
        <p>Close the agent terminal or press <code>s</code> in the TUI to stop sessions for that pack.</p>

        <h2 id="registry-404">Registry 404</h2>
        <p>
          Deploy the website with <code>/api/registry</code> and apply Supabase migrations. Bundled packs
          still work offline in the CLI catalog.
        </p>

        <h2 id="env">Environment</h2>
        <ul>
          <li><code>ORKESTRATE_REGISTRY_URL</code> — override registry endpoint</li>
          <li><code>ORKESTRATE_BUNDLED_REPO_URL</code> — GitHub source for bundled API entries</li>
        </ul>
      </div>
      <DocPrevNext href="/docs/help/troubleshooting" />
    </>
  );
}