import Header from "@/components/header";
import Footer from "@/components/footer";
import DocHeader from "@/components/docs/doc-header";

export default function ChangelogPage() {
  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <Header />
      <main className="mx-auto w-full max-w-[720px] flex-1 px-6 py-12">
        <DocHeader
          title="Changelog"
          description="Release notes for the Orkestrate website and CLI package."
        />
        <div className="doc-prose">
          <h2 id="unreleased">Unreleased</h2>
          <ul>
            <li>Website redesign — OpenAI-inspired docs, light/dark theme</li>
            <li>Registry API bundled fallback and pack seed migration</li>
            <li>Locked framing: specialized harnesses catalog</li>
          </ul>
          <h2 id="v0-1-0">v0.1.0</h2>
          <ul>
            <li>Pack model with OpenCode harness slices</li>
            <li>Detached terminal launch and pack homes</li>
            <li>Registry list/search/install and web submit</li>
          </ul>
        </div>
      </main>
      <Footer />
    </div>
  );
}