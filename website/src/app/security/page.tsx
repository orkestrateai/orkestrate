import Header from "@/components/header";
import Footer from "@/components/footer";
import DocHeader from "@/components/docs/doc-header";

export default function SecurityPage() {
  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <Header />
      <main className="mx-auto w-full max-w-[720px] flex-1 px-6 py-12">
        <DocHeader
          title="Security"
          description="Trust model for registry install, local launch, and hosted services."
        />
        <div className="doc-prose">
          <h2 id="install">Registry install</h2>
          <p>
            Approved entries point to GitHub repositories. Installing clones source you should trust.
            Review manifests on the registry before <code>registry install</code>.
          </p>
          <h2 id="review">Submissions</h2>
          <p>New packages are manually reviewed before approval.</p>
          <h2 id="local">Local execution</h2>
          <p>
            Launch runs OpenCode on your machine with pack-scoped config. Orkestrate does not execute
            remote code on your behalf beyond git clone for installs.
          </p>
          <h2 id="report">Report issues</h2>
          <p>Report vulnerabilities through the project GitHub security contact or issues.</p>
        </div>
      </main>
      <Footer />
    </div>
  );
}