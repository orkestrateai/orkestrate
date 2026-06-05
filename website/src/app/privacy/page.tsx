import Header from "@/components/header";
import Footer from "@/components/footer";
import DocHeader from "@/components/docs/doc-header";

export default function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <Header />
      <main className="mx-auto w-full max-w-[720px] flex-1 px-6 py-12">
        <DocHeader
          title="Privacy policy"
          description="How orkestrate.space handles data when you browse, authenticate, or submit packages."
        />
        <div className="doc-prose">
          <h2 id="collect">What we collect</h2>
          <p>
            Registry submissions store package metadata you provide, linked to your GitHub identity
            via Supabase Auth. Optional waitlist signups store email addresses if you use that feature.
          </p>
          <h2 id="local">Local CLI data</h2>
          <p>
            The CLI stores packs and pack homes under <code>.orkestrate/</code> on your machine. That
            data is not uploaded to Orkestrate by default.
          </p>
          <h2 id="contact">Contact</h2>
          <p>Questions: open an issue on the project GitHub repository.</p>
        </div>
      </main>
      <Footer />
    </div>
  );
}