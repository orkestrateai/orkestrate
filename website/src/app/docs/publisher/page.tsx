import Link from "next/link";
import CodeBlock from "@/components/CodeBlock";

export default function PublisherDocsPage() {
  const manifestCode = `{
  "id": "math-research-pack",
  "name": "Math Research Pack",
  "version": "0.1.0",
  "description": "Skills and prompts for solving advanced calculus and linear algebra problems.",
  "kind": "profile-pack",
  "author": "john-doe",
  "repository": "https://github.com/john-doe/math-research-pack",
  "contributes": {
    "profiles": ["math-researcher.json"],
    "skills": ["math-solver", "sympy-evaluator"],
    "adapters": [],
    "mcpServers": []
  }
}`;

  return (
    <div className="space-y-20">
      
      {/* ─── Centered Header ─── */}
      <section className="text-left pt-4 pb-2">
        <span className="text-[12px] font-bold uppercase tracking-[0.2em] text-neutral-400">
          Developer Guide
        </span>
        <h1 className="mt-3 text-[2.5rem] md:text-[3rem] font-bold tracking-tight text-white leading-[1.1]">
          Publisher Guide
        </h1>
        <p className="mt-4 text-[16px] leading-[1.65] text-[#A1A1AA] max-w-2xl">
          Learn how to package your domain expertise, system prompts, and custom harnesses into versioned extensions, write explicit manifests, and submit them to the Orkestrate registry for global distribution.
        </p>
      </section>

      {/* ─── Guide Sections ─── */}
      <div className="prose prose-invert max-w-none text-[15px] leading-[1.75] text-[#A1A1AA]">
        
        <h2 className="text-[20px] font-bold tracking-tight text-white border-b border-white/5 pb-2 pt-4">
          The Packaging Model
        </h2>
        <p className="mt-4">
          Orkestrate does not host your code. The registry acts purely as a decentralized pointer system mapping unique <code className="text-white bg-[#1c1c1e] px-1.5 py-0.5 rounded text-[13px] font-mono">id</code>s to raw GitHub repository URLs. When a user runs <code className="text-white bg-[#1c1c1e] px-1.5 py-0.5 rounded text-[13px] font-mono">orkestrate registry install &lt;package&gt;</code>, the CLI clones the source directly from the referenced URL.
        </p>
        <p>
          You can create three distinct categories of packages:
        </p>
        
        <ul className="mt-6 space-y-6 list-none pl-0">
          <li className="flex gap-4 items-start">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#18181b] border border-white/10 text-[10px] font-mono text-[#71717a] mt-0.5">A</span>
            <div>
              <strong className="text-white block mb-1">Profile Packs</strong>
              <p className="text-[#A1A1AA] leading-relaxed">
                The most common extension. A collection of JSON agent profiles, markdown skills, and system prompts. Does not contain any executable TypeScript logic. Excellent for sharing specialized workflows (e.g., "Senior iOS Developer", "Database Optimizer").
              </p>
            </div>
          </li>
          <li className="flex gap-4 items-start">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#18181b] border border-white/10 text-[10px] font-mono text-[#71717a] mt-0.5">B</span>
            <div>
              <strong className="text-white block mb-1">Harness Adapters</strong>
              <p className="text-[#A1A1AA] leading-relaxed">
                Executable TypeScript modules that bridge Orkestrate to a new external execution engine (e.g., connecting a new LangChain CLI). Must export an <code className="text-white bg-[#1c1c1e] px-1 py-0.5 rounded text-[12px] font-mono">OrkExtension</code> object containing a valid <code className="text-white bg-[#1c1c1e] px-1 py-0.5 rounded text-[12px] font-mono">HarnessAdapter</code>.
              </p>
            </div>
          </li>
          <li className="flex gap-4 items-start">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#18181b] border border-white/10 text-[10px] font-mono text-[#71717a] mt-0.5">C</span>
            <div>
              <strong className="text-white block mb-1">MCP Servers (Coming Soon)</strong>
              <p className="text-[#A1A1AA] leading-relaxed">
                Bundled Model Context Protocol servers that expose local tools, SQL databases, or internal APIs securely to the sandboxed agent runtimes.
              </p>
            </div>
          </li>
        </ul>

        <h2 className="text-[20px] font-bold tracking-tight text-white border-b border-white/5 pb-2 pt-4 mt-12">
          Writing the Manifest
        </h2>
        <p className="mt-4">
          At the root of your GitHub repository, you must include an <code className="text-white bg-[#1c1c1e] px-1.5 py-0.5 rounded text-[13px] font-mono">orkestrate.extension.json</code> file. This is the source of truth that dictates exactly what your package contributes to the global Orkestrate registry.
        </p>

        <CodeBlock code={manifestCode} lang="json" theme="vitesse-dark" />

        <ul className="space-y-4 text-[14px] mt-6 list-none pl-0">
          <li className="flex gap-4 items-start">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#18181b] border border-white/10 text-[10px] font-mono text-[#71717a] mt-0.5">!</span>
            <div>
              <strong className="text-white block mb-1">Strict Validation Rules</strong>
              <p className="text-[#A1A1AA] leading-relaxed">
                The <code className="text-white bg-[#1c1c1e] px-1 py-0.5 rounded text-[12px] font-mono">id</code> field must be unique globally and conventionally uses a kebab-case format. The <code className="text-white bg-[#1c1c1e] px-1 py-0.5 rounded text-[12px] font-mono">version</code> must strictly adhere to Semantic Versioning (SemVer) (e.g. <code className="text-white bg-[#1c1c1e] px-1 py-0.5 rounded text-[12px] font-mono">1.0.0</code>).
              </p>
            </div>
          </li>
        </ul>

        <h2 className="text-[20px] font-bold tracking-tight text-white border-b border-white/5 pb-2 pt-4 mt-12">
          CLI Verification & Linting
        </h2>
        <p className="mt-4">
          Before submitting your package, you must verify the structural integrity of your manifest using the local Orkestrate CLI. The CLI will execute a Zod schema validation against your JSON file and flag any missing properties.
        </p>
        
        <CodeBlock code="orkestrate extension validate ./" lang="bash" theme="vitesse-dark" />

        <h2 className="text-[20px] font-bold tracking-tight text-white border-b border-white/5 pb-2 pt-4 mt-12">
          Submission & Review Process
        </h2>
        <p className="mt-4">
          Once your repository is public and your manifest is validated, you can submit the package to the official registry. Provide the raw GitHub URL to your manifest. Our automated pipeline will pull the manifest, verify the syntax, and enqueue it for manual review.
        </p>
        
        <div className="pt-8">
          <Link
            href="/submit"
            className="inline-flex h-9 items-center rounded-full bg-white px-5 text-[12px] font-semibold text-black hover:bg-neutral-200 transition-all"
          >
            Submit to Registry →
          </Link>
        </div>
        
      </div>
    </div>
  );
}
