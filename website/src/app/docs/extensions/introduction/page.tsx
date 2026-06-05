import CodeBlock from "@/components/CodeBlock";

export default function IntroductionPage() {
  const tsCode = `import type { OrkExtension, ExtensionContext } from "orkestrate";
import { MyDummyAdapter } from "./adapter";

// Orkestrate looks for the default export or a named 'extension' export
export default {
  id: "com.example.helloworld",
  name: "Hello World Engine",
  version: "1.0.0",
  
  activate(ctx: ExtensionContext) {
    console.log("Hello World extension activating!");
    
    // Register the adapter under the harness key "hello-engine"
    ctx.registerAdapter("hello-engine", new MyDummyAdapter());
  }
} satisfies OrkExtension;`;

  const structureCode = `my-custom-adapter/
├── package.json              # Defines dependencies
├── tsconfig.json             # TypeScript configuration
├── orkestrate.extension.json # The registry manifest
└── src/
    ├── index.ts              # Entry point exporting OrkExtension
    └── customAdapter.ts      # Logic implementing HarnessAdapter`;

  const coreInterfaceCode = `export interface OrkExtension {
  id: string;
  name: string;
  version: string;
  activate(ctx: ExtensionContext): void | Promise<void>;
}`;

  return (
    <div className="space-y-12">
      <section className="text-left pt-4 pb-2">
        <span className="text-[12px] font-bold uppercase tracking-[0.2em] text-neutral-400">
          Extensions
        </span>
        <h1 className="mt-3 text-[2.5rem] md:text-[3rem] font-bold tracking-tight text-white leading-[1.1]">
          Introduction
        </h1>
        <p className="mt-4 text-[16px] leading-[1.65] text-[#A1A1AA] max-w-2xl">
          Orkestrate is built on the core thesis that harnesses are components and specialized agents are composable primitives. The dynamic extension system provides the engine for this modularity, pushing complex runtime integrations out of the core CLI.
        </p>
      </section>

      <div className="prose prose-invert max-w-none text-[15px] leading-[1.75] text-[#A1A1AA]">
        <h2 className="text-[20px] font-bold tracking-tight text-white border-b border-white/5 pb-2 pt-4 mt-8">
          Why Extensions?
        </h2>
        <p className="mt-4">
          Rather than hardcoding integrations for every new AI runtime (like Pi, Claude Code, or OpenCode) directly into the Orkestrate CLI, we push harness logic out to the extension layer. This achieves two critical goals:
        </p>
        <ul className="mt-4 space-y-4 list-none pl-0">
          <li className="flex gap-4 items-start">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#18181b] border border-white/10 text-[10px] font-mono text-[#71717a] mt-0.5">1</span>
            <div>
              <strong className="text-white block mb-1">Decoupled Release Cycles</strong>
              <p className="text-[#A1A1AA] leading-relaxed">
                Community developers can immediately ship support for new execution engines without waiting for Orkestrate Core updates. If Anthropic releases a new version of Claude Code that requires new flags, an adapter extension can be bumped and pushed to the registry independently.
              </p>
            </div>
          </li>
          <li className="flex gap-4 items-start">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#18181b] border border-white/10 text-[10px] font-mono text-[#71717a] mt-0.5">2</span>
            <div>
              <strong className="text-white block mb-1">Zero-Bloat Core</strong>
              <p className="text-[#A1A1AA] leading-relaxed">
                Users only load the adapters and capabilities they actively need. This keeps the initial Orkestrate bootstrap path lightning fast and prevents dependency bloat from accumulating over time.
              </p>
            </div>
          </li>
        </ul>

        <h2 className="text-[20px] font-bold tracking-tight text-white border-b border-white/5 pb-2 pt-4 mt-12">
          Anatomy of an Extension
        </h2>
        <p className="mt-4">
          At its core, an extension is simply a local Node/Bun module that exports an <code className="text-white bg-[#1c1c1e] px-1.5 py-0.5 rounded text-[13px] font-mono">OrkExtension</code> object. Orkestrate discovers these packages dynamically. A typical extension repository looks like this:
        </p>

        <CodeBlock code={structureCode} lang="bash" theme="vitesse-dark" />

        <h3 className="text-[16px] font-semibold text-white mt-8 mb-4">Core Interface Definition</h3>
        <p>
          Every extension must export a default object that satisfies the <code className="text-white bg-[#1c1c1e] px-1.5 py-0.5 rounded text-[13px] font-mono">OrkExtension</code> schema. This object provides the metadata and the lifecycle hooks required by the Orkestrate runtime before it mounts the capabilities.
        </p>

        <CodeBlock code={coreInterfaceCode} lang="typescript" theme="vitesse-dark" />

        <h2 className="text-[20px] font-bold tracking-tight text-white border-b border-white/5 pb-2 pt-4 mt-12">
          Quickstart: Hello World Adapter
        </h2>
        <p className="mt-4">
          Let's build a stub extension that registers a hypothetical adapter. Navigate to your workspace extension directory (e.g., <code className="text-white bg-[#1c1c1e] px-1.5 py-0.5 rounded text-[13px] font-mono">./.orkestrate/extensions/hello-world</code>) and create an <code className="text-white bg-[#1c1c1e] px-1.5 py-0.5 rounded text-[13px] font-mono">index.ts</code> file.
        </p>

        <CodeBlock code={tsCode} lang="typescript" theme="vitesse-dark" />

        <p className="mt-4">
          When Orkestrate boots, it dynamically imports this file. If the exported object satisfies the strict schema validations, the <code className="text-white bg-[#1c1c1e] px-1.5 py-0.5 rounded text-[13px] font-mono">activate()</code> lifecycle hook is invoked, granting your code access to the <code className="text-white bg-[#1c1c1e] px-1.5 py-0.5 rounded text-[13px] font-mono">ExtensionContext</code>. The `ExtensionContext` is the only safe gateway to register capabilities into the registry state.
        </p>
      </div>
    </div>
  );
}
