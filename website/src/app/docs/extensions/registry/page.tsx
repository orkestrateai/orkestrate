import CodeBlock from "@/components/CodeBlock";

export default function RegistryApiPage() {
  const contextCode = `export interface ExtensionContext {
  registerAdapter(harness: string, adapter: HarnessAdapter): void;
}`;

  const launchContextCode = `export interface LaunchContext {
  /** The root directory where Orkestrate was executed by the user */
  cwd: string;
  
  /** An isolated directory generated specifically for this execution session */
  sessionDir: string;
  
  /** The global environment variables captured from the host system */
  env: Record<string, string | undefined>;
}`;

  const launchConfigCode = `export interface HarnessLaunchConfig {
  /** The executable binary to run (e.g. "pi", "claude", "opencode") */
  command: string;
  
  /** CLI arguments to pass sequentially to the binary */
  args: string[];
  
  /** 
   * Custom environment overrides for the subprocess. 
   * These are merged with process.env.
   */
  env?: Record<string, string | undefined>;
  
  /** Working directory override (defaults to context.cwd) */
  cwd?: string;
}`;

  const exampleCode = `import type { OrkExtension, ExtensionContext } from "orkestrate";
import { MyCustomAdapter } from "./adapter";

export const extension: OrkExtension = {
  id: "orkestrate.adapter.custom",
  name: "Custom Agent Engine",
  version: "1.0.0",
  
  activate(ctx: ExtensionContext) {
    const adapter = new MyCustomAdapter();
    
    // Register the adapter under the harness key "custom-engine"
    ctx.registerAdapter("custom-engine", adapter);
  }
};

export default extension;`;

  return (
    <div className="space-y-12">
      <section className="text-left pt-4 pb-2">
        <span className="text-[12px] font-bold uppercase tracking-[0.2em] text-neutral-400">
          Extensions
        </span>
        <h1 className="mt-3 text-[2.5rem] md:text-[3rem] font-bold tracking-tight text-white leading-[1.1]">
          Registry API
        </h1>
        <p className="mt-4 text-[16px] leading-[1.65] text-[#A1A1AA] max-w-2xl">
          The Extension Registry is the central nervous system of Orkestrate. It operates as an in-memory singleton mapping holding all dynamically loaded capabilities, adapters, and schemas.
        </p>
      </section>

      <div className="prose prose-invert max-w-none text-[15px] leading-[1.75] text-[#A1A1AA]">
        
        <h2 className="text-[20px] font-bold tracking-tight text-white border-b border-white/5 pb-2 pt-4 mt-8">
          Interacting with the Context
        </h2>
        <p className="mt-4">
          When Orkestrate invokes your extension's <code className="text-white bg-[#1c1c1e] px-1.5 py-0.5 rounded text-[13px] font-mono">activate</code> method, it passes in the current <code className="text-white bg-[#1c1c1e] px-1.5 py-0.5 rounded text-[13px] font-mono">ExtensionContext</code>. This interface is intentionally minimalist to enforce clear capability boundaries and prevent extensions from mutating core application state.
        </p>

        <CodeBlock code={contextCode} lang="typescript" theme="vitesse-dark" />

        <h3 className="text-[16px] font-semibold text-white mt-8 mb-4">Registering Adapters</h3>
        <p>
          The most common use case for an extension is to register a new <code className="text-white bg-[#1c1c1e] px-1.5 py-0.5 rounded text-[13px] font-mono">HarnessAdapter</code>. The string identifier provided as the first argument will act as the exact lookup key when parsing a Profile JSON manifest. For example, if you register under <code className="text-white bg-[#1c1c1e] px-1.5 py-0.5 rounded text-[13px] font-mono">custom-engine</code>, any Profile that defines <code className="text-white bg-[#1c1c1e] px-1.5 py-0.5 rounded text-[13px] font-mono">"harness": "custom-engine"</code> will route to your code.
        </p>

        <CodeBlock code={exampleCode} lang="typescript" theme="vitesse-dark" />

        <h2 className="text-[20px] font-bold tracking-tight text-white border-b border-white/5 pb-2 pt-4 mt-12">
          Type Definitions Reference
        </h2>
        <p className="mt-4">
          To successfully build an extension, you need a firm grasp of the core types governing the Registry data structures.
        </p>

        <h3 className="text-[16px] font-semibold text-white mt-8 mb-4">The Launch Context</h3>
        <p>
          When <code className="text-white bg-[#1c1c1e] px-1.5 py-0.5 rounded text-[13px] font-mono">prepareLaunch()</code> is invoked on your adapter, it receives both the requested profile and the current LaunchContext. This context encapsulates crucial filesystem bounds.
        </p>

        <CodeBlock code={launchContextCode} lang="typescript" theme="vitesse-dark" />

        <h3 className="text-[16px] font-semibold text-white mt-8 mb-4">The Launch Config</h3>
        <p>
          Your adapter must ultimately return a <code className="text-white bg-[#1c1c1e] px-1.5 py-0.5 rounded text-[13px] font-mono">HarnessLaunchConfig</code> object. Orkestrate's node-pty bridge will ingest this exact configuration to spawn and render the final interactive terminal subprocess.
        </p>

        <CodeBlock code={launchConfigCode} lang="typescript" theme="vitesse-dark" />

        <h2 className="text-[20px] font-bold tracking-tight text-white border-b border-white/5 pb-2 pt-4 mt-12">
          State Management & Collisions
        </h2>
        <p className="mt-4">
          The Registry maintains its state internally using standard JavaScript <code className="text-white bg-[#1c1c1e] px-1.5 py-0.5 rounded text-[13px] font-mono">Map</code> objects. When your extension calls <code className="text-white bg-[#1c1c1e] px-1.5 py-0.5 rounded text-[13px] font-mono">ctx.registerAdapter</code>, Orkestrate maps the harness string directly to your class instance.
        </p>

        <ul className="space-y-4 text-[14px] mt-6 list-none pl-0">
          <li className="flex gap-4 items-start">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#18181b] border border-white/10 text-[10px] font-mono text-[#71717a] mt-0.5">!</span>
            <div>
              <strong className="text-white block mb-1">Silent Shadowing</strong>
              <p className="text-[#A1A1AA] leading-relaxed">
                The Registry deliberately utilizes a <strong>last-write-wins</strong> conflict resolution model. Because extensions are loaded in a strict priority order (Workspace {'>'} Global {'>'} Bundled), a workspace extension can safely and intentionally overwrite a bundled adapter by registering the exact same string identifier. This is a feature, allowing developers to mock or proxy native harnesses in local projects.
              </p>
            </div>
          </li>
        </ul>

      </div>
    </div>
  );
}
