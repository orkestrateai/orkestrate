import { listProfiles, saveProfile, workspaceProfilesDir } from "../../sdk/profiles/load";
import { parseProfile, type Profile } from "../../sdk/profiles/schema";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

const TEMPLATES: Record<string, Omit<Profile, "name">> = {
  "extension-builder": {
    description: "Specialized profile for building Orkestrate extensions and adapters",
    harness: "opencode",
    info: `I am a profile builder for the Orkestrate workbench. I help create new agent profiles, extensions, and harness adapters.

## Capabilities
- **Profile Authoring**: Design valid agent profiles with proper metadata and config
- **Extension Development**: Write OrkExtension modules with activation hooks
- **Adapter Creation**: Build HarnessAdapter implementations for new runtimes
- **Validation**: Verify profiles/extensions compile and conform to interfaces

## Key References
- \`src/sdk/profiles/schema.ts\` - Profile schema and validation
- \`src/sdk/extensions/types.ts\` - Extension interface
- \`src/sdk/types.ts\` - HarnessAdapter interface
- \`extensions/opencode-adapter/index.ts\` - Example adapter

## Workflow
1. Define profile purpose and target harness
2. Write \`info\` intro (this field) + \`config\` (model, tools, resources)
3. Run \`orkestrate profile validate <name>\` to verify
4. Test launch via \`orkestrate\` TUI
5. Submit to registry when ready`,
    config: {
      workspace: { root: ".", policy: "current-directory" },
      model: { provider: "default", id: "default", thinking: "high", cycle: [] },
      prompt: "Help create, validate, and package Orkestrate profiles and extensions.",
      resources: { skills: ["orkestrate"], prompts: [], extensions: [], mcpServers: [] },
      tools: { allow: ["read", "write", "edit", "bash", "grep", "glob"], deny: [] },
      session: { dir: ".orkestrate/opencode-sessions/profile-builder" },
    },
  },
  "coding": {
    description: "General-purpose coding agent",
    harness: "opencode",
    info: `I am a general-purpose software development agent.

## Capabilities
- **Code Editing**: Read, write, edit files with full language support
- **Shell Access**: Run commands, tests, builds, git operations
- **Search & Navigate**: Grep, glob, LSP-powered code intelligence
- **Task Management**: Todo tracking for complex multi-step work

## Workflow
1. Understand the task and repository context
2. Make small, reviewable changes
3. Verify with tests and typechecks
4. Follow repository conventions

## Constraints
- Prefer minimal, focused changes
- Ask before destructive operations
- Respect existing code style`,
    config: {
      workspace: { root: ".", policy: "current-directory" },
      model: { provider: "default", id: "default", thinking: "default", cycle: [] },
      prompt: "Use the Orkestrate coding profile. Prioritize small, reviewable changes, clear verification, and repository instructions.",
      resources: { skills: ["orkestrate"], prompts: [], extensions: [], mcpServers: [] },
      tools: { allow: ["read", "grep", "glob", "bash", "edit", "write"], deny: [] },
      session: { dir: ".orkestrate/opencode-sessions/coding" },
    },
  },
  "research": {
    description: "Research and analysis agent",
    harness: "opencode",
    info: `I am a research agent for deep analysis, literature review, and synthesis.

## Capabilities
- **Web Research**: Fetch and analyze online sources
- **Document Analysis**: Read and summarize PDFs, papers, docs
- **Synthesis**: Combine findings into structured reports
- **Fact Checking**: Verify claims against sources

## Workflow
1. Define research question and scope
2. Gather sources (web, local files, papers)
3. Analyze and extract key findings
4. Synthesize into structured output with citations

## Tools
- Web fetch/search for live data
- File reading for local documents
- Todo tracking for multi-phase research`,
    config: {
      workspace: { root: ".", policy: "current-directory" },
      model: { provider: "default", id: "default", thinking: "high", cycle: [] },
      prompt: "Conduct thorough research. Cite sources. Distinguish facts from speculation.",
      resources: { skills: ["orkestrate"], prompts: [], extensions: [], mcpServers: [] },
      tools: { allow: ["read", "write", "edit", "bash", "grep", "glob", "webfetch", "websearch"], deny: [] },
      session: { dir: ".orkestrate/opencode-sessions/research" },
    },
  },
};

export async function runProfileCreate(options: {
  name: string;
  template?: string;
  interactive?: boolean;
  global?: boolean;
}): Promise<void> {
  const { name, template, interactive, global } = options;

  // Validate name
  if (!/^[a-z0-9][a-z0-9-_]*$/.test(name)) {
    console.error(`${RED}Error:${RESET} Profile name must use lowercase letters, numbers, "-", or "_" (e.g., "my-profile")`);
    process.exitCode = 1;
    return;
  }

  // Check if profile already exists
  const existing = await listProfiles({ warn: false });
  if (existing.some(p => p.name === name)) {
    console.error(`${RED}Error:${RESET} Profile "${name}" already exists`);
    process.exitCode = 1;
    return;
  }

  let profileData: Profile;

  if (template && TEMPLATES[template]) {
    // Use template
    profileData = { name, ...TEMPLATES[template] };
    console.log(`${GREEN}✓${RESET} Created from template: ${template}`);
  } else if (interactive) {
    // Interactive mode - prompt for fields
    profileData = await interactiveCreate(name);
  } else {
    // Minimal default
    profileData = {
      name,
      description: `${name} profile`,
      harness: "opencode",
      info: `I am the ${name} profile. Describe my capabilities and purpose here.`,
      config: {
        workspace: { root: ".", policy: "current-directory" },
        model: { provider: "default", id: "default", thinking: "default", cycle: [] },
        prompt: `Use the ${name} profile.`,
        resources: { skills: [], prompts: [], extensions: [], mcpServers: [] },
        tools: { allow: [], deny: [] },
        session: { dir: `.orkestrate/opencode-sessions/${name}` },
      },
    };
    console.log(`${YELLOW}⚠${RESET} Created minimal profile. Edit with \`orkestrate\` TUI (press 'e') to customize.`);
  }

  // Validate
  try {
    parseProfile(profileData);
  } catch (error) {
    console.error(`${RED}Error:${RESET} Generated profile invalid:`, error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
    return;
  }

  // Save
  try {
    await saveProfile(profileData, { isGlobal: global });
    const location = global ? "global (~/.orkestrate/profiles)" : "workspace (.orkestrate/profiles)";
    console.log(`${GREEN}✓${RESET} Profile saved to ${location}`);
    console.log("");
    console.log(`Next steps:`);
    console.log(`  orkestrate profile validate ${name}  # Verify configuration`);
    console.log(`  orkestrate                             # Launch via TUI (select profile, press Enter)`);
  } catch (error) {
    console.error(`${RED}Error:${RESET} Failed to save profile:`, error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

async function interactiveCreate(name: string): Promise<Profile> {
  // For now, return minimal - full interactive would need inquirer or similar
  console.log("Interactive mode not fully implemented yet. Use --template or edit after creation.");
  return {
    name,
    description: `${name} profile`,
    harness: "opencode",
    info: `I am the ${name} profile. Describe my capabilities and purpose here.`,
    config: {
      workspace: { root: ".", policy: "current-directory" },
      model: { provider: "default", id: "default", thinking: "default", cycle: [] },
      prompt: `Use the ${name} profile.`,
      resources: { skills: [], prompts: [], extensions: [], mcpServers: [] },
      tools: { allow: [], deny: [] },
      session: { dir: `.orkestrate/opencode-sessions/${name}` },
    },
  };
}