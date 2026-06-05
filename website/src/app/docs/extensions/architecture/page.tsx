import CodeBlock from "@/components/CodeBlock";

export default function ArchitecturePage() {
  const loaderCode = `// Validate OrkExtension shape before activating
const missing: string[] = [];
if (typeof raw.id !== "string" || !raw.id) missing.push("id");
if (typeof raw.name !== "string" || !raw.name) missing.push("name");
if (typeof raw.version !== "string" || !raw.version) missing.push("version");
if (typeof raw.activate !== "function") missing.push("activate");

if (missing.length > 0) {
  console.warn(\`Extension at "\${dir}" is missing required field(s): \${missing.join(", ")} — skipping\`);
  continue;
}`;

  return (
    <div className="space-y-12">
      <section className="text-left pt-4 pb-2">
        <span className="text-[12px] font-bold uppercase tracking-[0.2em] text-neutral-400">
          Extensions
        </span>
        <h1 className="mt-3 text-[2.5rem] md:text-[3rem] font-bold tracking-tight text-white leading-[1.1]">
          Architecture
        </h1>
        <p className="mt-4 text-[16px] leading-[1.65] text-[#A1A1AA] max-w-2xl">
          The Orkestrate extension system dynamically discovers, loads, and activates modules during the CLI bootstrapping phase. Understanding this loading phase is critical to debugging extension conflicts and security boundaries.
        </p>
      </section>

      <div className="prose prose-invert max-w-none text-[15px] leading-[1.75] text-[#A1A1AA]">
        
        <h2 className="text-[20px] font-bold tracking-tight text-white border-b border-white/5 pb-2 pt-4 mt-8">
          The Loader Algorithm
        </h2>
        <p className="mt-4">
          When Orkestrate starts, the <code className="text-white bg-[#1c1c1e] px-1.5 py-0.5 rounded text-[13px] font-mono">loadExtensions()</code> routine executes. It relies on the native ESM dynamic <code className="text-white bg-[#1c1c1e] px-1.5 py-0.5 rounded text-[13px] font-mono">import()</code> capabilities of the V8 engine (via Bun). The discovery engine scans specific directories in a strict priority order.
        </p>

        <ul className="mt-6 space-y-6 list-none pl-0">
          <li className="flex gap-4 items-start border-l-2 border-[#333] pl-4 py-1">
            <div>
              <strong className="text-white block mb-1 text-[16px]">Priority 1: Bundled</strong>
              <p className="text-[13px] font-mono text-[#52525b] mb-2 bg-[#0a0a0a] px-2 py-1 rounded inline-block border border-white/5">extensions/</p>
              <p className="text-[#A1A1AA] leading-relaxed mt-1">
                First-party adapters shipped directly alongside the CLI codebase. These are loaded first and serve as the baseline fallbacks.
              </p>
            </div>
          </li>
          <li className="flex gap-4 items-start border-l-2 border-[#333] pl-4 py-1">
            <div>
              <strong className="text-white block mb-1 text-[16px]">Priority 2: Global</strong>
              <p className="text-[13px] font-mono text-[#52525b] mb-2 bg-[#0a0a0a] px-2 py-1 rounded inline-block border border-white/5">~/.orkestrate/extensions/</p>
              <p className="text-[#A1A1AA] leading-relaxed mt-1">
                User-installed extensions via the registry. These are loaded next, allowing them to override bundled behaviors globally for the specific user environment.
              </p>
            </div>
          </li>
          <li className="flex gap-4 items-start border-l-2 border-white pl-4 py-1">
            <div>
              <strong className="text-white block mb-1 text-[16px]">Priority 3: Workspace</strong>
              <p className="text-[13px] font-mono text-white mb-2 bg-[#1c1c1e] px-2 py-1 rounded inline-block border border-white/20">./.orkestrate/extensions/</p>
              <p className="text-neutral-300 leading-relaxed mt-1">
                Project-specific sandbox extensions located in the current working directory. These are loaded last, guaranteeing they have the highest priority and can safely shadow or mock any global or bundled adapter.
              </p>
            </div>
          </li>
        </ul>

        <p className="mt-8">
          For every directory found within these paths, the loader checks if an entry point exists (<code className="text-white bg-[#1c1c1e] px-1.5 py-0.5 rounded text-[13px] font-mono">index.ts</code>, <code className="text-white bg-[#1c1c1e] px-1.5 py-0.5 rounded text-[13px] font-mono">index.js</code>, or <code className="text-white bg-[#1c1c1e] px-1.5 py-0.5 rounded text-[13px] font-mono">package.json</code>) before attempting to evaluate the module.
        </p>

        <h2 className="text-[20px] font-bold tracking-tight text-white border-b border-white/5 pb-2 pt-4 mt-12">
          Validation Rules & Strict Typing
        </h2>
        <p className="mt-4">
          Once the module is imported, Orkestrate looks for the default export or a named <code className="text-white bg-[#1c1c1e] px-1.5 py-0.5 rounded text-[13px] font-mono">extension</code> export. Before handing over the sensitive <code className="text-white bg-[#1c1c1e] px-1.5 py-0.5 rounded text-[13px] font-mono">ExtensionContext</code>, the runtime performs a rigid schema validation:
        </p>

        <CodeBlock code={loaderCode} lang="typescript" theme="vitesse-dark" />

        <p>
          This rigid typing check prevents malformed, outdated, or incomplete packages from crashing the entire CLI. If an extension fails this validation or throws an uncaught exception during the <code className="text-white bg-[#1c1c1e] px-1.5 py-0.5 rounded text-[13px] font-mono">activate()</code> hook, the error is isolated inside a <code className="text-white bg-[#1c1c1e] px-1.5 py-0.5 rounded text-[13px] font-mono">try/catch</code> block. A warning is logged, and the loader gracefully moves to the next directory.
        </p>

        <h2 className="text-[20px] font-bold tracking-tight text-white border-b border-white/5 pb-2 pt-4 mt-12">
          Security & Sandboxing
        </h2>
        <p className="mt-4">
          Because Orkestrate loads modules dynamically at runtime, you must be hyper-aware of the security boundaries present in the engine.
        </p>

        <ul className="space-y-6 text-[14px] mt-6 list-none pl-0">
          <li className="flex gap-4 items-start">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#18181b] border border-white/10 text-[10px] font-mono text-[#71717a] mt-0.5">!</span>
            <div>
              <strong className="text-white block mb-1">Shared Isolate Permissions</strong>
              <p className="text-[#A1A1AA] leading-relaxed">
                Extensions are executed via native dynamic imports within the exact same V8 isolate as the Orkestrate CLI. This means they inherit the identical filesystem, network, and environment permissions as the host process. There are no WebAssembly (Wasm) or separate VM sandboxes isolating malicious code. Only install extensions from publishers you implicitly trust.
              </p>
            </div>
          </li>
          <li className="flex gap-4 items-start">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#18181b] border border-white/10 text-[10px] font-mono text-[#71717a] mt-0.5">!</span>
            <div>
              <strong className="text-white block mb-1">Deactivation Constraints</strong>
              <p className="text-[#A1A1AA] leading-relaxed">
                Currently, the system lacks a formal <code className="text-white bg-[#1c1c1e] px-1 py-0.5 rounded text-[12px] font-mono">deactivate()</code> hook. Extensions should avoid spawning orphaned background processes or leaving long-running listeners attached during initialization. All cleanup logic should be returned exclusively via the adapter's <code className="text-white bg-[#1c1c1e] px-1 py-0.5 rounded text-[12px] font-mono">prepareLaunch()</code> response callback, which the core guarantees will fire.
              </p>
            </div>
          </li>
        </ul>
      </div>
    </div>
  );
}
