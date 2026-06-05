import CodeBlock from "@/components/CodeBlock";

export default function AdaptersPage() {
  const detectCode = `async detect(): Promise<HarnessStatus> {
  try {
    const proc = Bun.spawnSync(["pi", "--version"]);
    if (proc.success) {
      const version = proc.stdout.toString().trim();
      return { installed: true, version };
    }
    return { installed: false, error: "pi CLI returned error" };
  } catch (err) {
    return { installed: false, error: "pi not found in PATH" };
  }
}`;

  const launchCode = `async prepareLaunch(profile, context) {
  // 1. Generate a unique, isolated session directory
  const sessionPath = path.join(process.cwd(), ".orkestrate", "sessions", randomUUID());
  await fs.mkdir(sessionPath, { recursive: true });

  // 2. Write the compiled configuration into this temporary path
  const configContent = compileProfileToHarnessNativeConfig(profile);
  await fs.writeFile(path.join(sessionPath, "config.json"), configContent);

  return {
    config: {
      command: "opencode",
      args: ["--interactive"],
      // 3. Hijack the HOME environment variables to point to the isolated session
      env: {
        ...process.env,
        HOME: sessionPath,
        USERPROFILE: sessionPath
      }
    },
    cleanup: async () => {
      // 4. Wipe the session directory when the agent exits
      await fs.rm(sessionPath, { recursive: true, force: true });
    }
  };
}`;

  const interfaceCode = `export interface HarnessAdapter {
  id: string;
  name: string;
  
  capabilities: {
    mcp: boolean;
    systemPrompt: boolean;
    skills: boolean;
    modelSelection: boolean;
  };
  
  detect(): Promise<HarnessStatus>;
  
  prepareLaunch(
    profile: Profile,
    context: LaunchContext
  ): Promise<{
    config: HarnessLaunchConfig;
    cleanup: () => Promise<void>;
  }>;
}`;

  return (
    <div className="space-y-12">
      <section className="text-left pt-4 pb-2">
        <span className="text-[12px] font-bold uppercase tracking-[0.2em] text-neutral-400">
          Extensions
        </span>
        <h1 className="mt-3 text-[2.5rem] md:text-[3rem] font-bold tracking-tight text-white leading-[1.1]">
          Harness Adapters
        </h1>
        <p className="mt-4 text-[16px] leading-[1.65] text-[#A1A1AA] max-w-2xl">
          Harness Adapters are the runtime bridges that translate high-level Orkestrate agent profiles into execution configurations for external CLI or TUI engines.
        </p>
      </section>

      <div className="prose prose-invert max-w-none text-[15px] leading-[1.75] text-[#A1A1AA]">
        
        <h2 className="text-[20px] font-bold tracking-tight text-white border-b border-white/5 pb-2 pt-4 mt-8">
          The Harness Adapter Interface
        </h2>
        <p className="mt-4">
          To register a new runtime engine, your extension must provide an implementation of the <code className="text-white bg-[#1c1c1e] px-1.5 py-0.5 rounded text-[13px] font-mono">HarnessAdapter</code> interface.
        </p>

        <CodeBlock code={interfaceCode} lang="typescript" theme="vitesse-dark" />

        <h2 className="text-[20px] font-bold tracking-tight text-white border-b border-white/5 pb-2 pt-4 mt-12">
          The Detection Phase
        </h2>
        <p className="mt-4">
          Before a profile can be launched, Orkestrate must verify that the underlying harness is actually installed on the user's system. The <code className="text-white bg-[#1c1c1e] px-1.5 py-0.5 rounded text-[13px] font-mono">detect()</code> method handles this validation. Orkestrate never attempts to auto-install binaries; it purely audits the host environment.
        </p>

        <p>
          Detection is typically performed by spawning a lightweight, synchronous subprocess (e.g. executing <code className="text-white bg-[#1c1c1e] px-1.5 py-0.5 rounded text-[13px] font-mono">harness --version</code>). Here is an exact real-world example derived from the Pi adapter codebase:
        </p>

        <CodeBlock code={detectCode} lang="typescript" theme="vitesse-dark" />

        <h2 className="text-[20px] font-bold tracking-tight text-white border-b border-white/5 pb-2 pt-4 mt-12">
          Environment Preparation & Hijacking
        </h2>
        <p className="mt-4">
          If detection passes, Orkestrate calls <code className="text-white bg-[#1c1c1e] px-1.5 py-0.5 rounded text-[13px] font-mono">prepareLaunch()</code>. This is the most complex and critical phase of the adapter architecture. It must convert the abstract Profile manifest (a JSON object defining models, tools, and prompts) into the specific configuration files and command-line flags strictly required by the harness.
        </p>

        <p>
          Some harnesses, like OpenCode or Claude Code, expect configurations to live globally in <code className="text-white bg-[#1c1c1e] px-1.5 py-0.5 rounded text-[13px] font-mono">~/.opencode/</code> or <code className="text-white bg-[#1c1c1e] px-1.5 py-0.5 rounded text-[13px] font-mono">~/.claude/</code>. To prevent our dynamic agent profiles from permanently overwriting a user's global settings and destroying their personal setup, advanced adapters utilize a technique known as <strong>Home Hijacking</strong> alongside <strong>Session Isolation</strong>.
        </p>

        <CodeBlock code={launchCode} lang="typescript" theme="vitesse-dark" />

        <h2 className="text-[20px] font-bold tracking-tight text-white border-b border-white/5 pb-2 pt-4 mt-12">
          The Cleanup Guarantee
        </h2>
        <p className="mt-4">
          Notice the <code className="text-white bg-[#1c1c1e] px-1.5 py-0.5 rounded text-[13px] font-mono">cleanup</code> callback returned at the bottom of the previous example. Orkestrate ensures this function is executed unconditionally via its internal PTY bridge router—whether the harness process exits cleanly, crashes violently, or is forcibly <kbd>Ctrl+C</kbd> killed by the user. 
        </p>
        <p>
          This guarantees that your adapters don't leave gigabytes of orphaned session configurations, stray logs, and temporary sandbox directories scattered across the user's disk over time. Always rely on this hook for post-execution state purging.
        </p>

      </div>
    </div>
  );
}
