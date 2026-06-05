# Harness Adapters

Harness Adapters are the runtime bridges that translate high-level Orkestrate agent profiles into execution configurations for external CLI or TUI engines. By building a harness adapter, you enable Orkestrate to launch and control entirely new agent environments.

## The Harness Adapter Interface

To register a new runtime engine, your extension must provide an implementation of the `HarnessAdapter` interface.

```typescript
export interface HarnessAdapter {
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
}
```

## Core Responsibilities

An adapter must handle three primary phases of the agent lifecycle: **Detection**, **Environment Preparation**, and **Cleanup**.

### 1. Detection

Before a profile can be launched, Orkestrate asks the adapter if the target harness is available on the user's system. The `detect()` method typically spawns a synchronous subprocess (e.g., `opencode --version`) to verify installation and report the status.

### 2. Environment Preparation

The `prepareLaunch()` method is where the heavy lifting occurs. When a user requests to run a profile, the adapter must convert the profile's declarative manifest into something the target harness understands.

Common tasks in this phase include:
- **Session Isolation**: Spawning unique session root folders (e.g., `.orkestrate/sessions/<uuid>`).
- **Home Hijacking**: Redirecting environment variables like `USERPROFILE`, `HOME`, and `XDG_CONFIG_HOME` to prevent the agent from modifying the user's global settings.
- **Dynamic Configuration**: Converting Orkestrate tool policies and MCP server definitions into the native configuration format of the harness (e.g., generating an `opencode.json` file).
- **Prompt Construction**: Merging profile-scoped `SKILL.md` files into a unified system instruction set.

### 3. Cleanup

To prevent stale environments and dangling files, `prepareLaunch` must return an asynchronous `cleanup()` callback. Orkestrate guarantees that this callback is invoked recursively upon process exit, ensuring temporary session folders are properly removed.

## Example: The OpenCode Adapter

The bundled `opencode-adapter` demonstrates the full capability of the adapter contract. It handles deep session isolation, dynamically parses tool constraints into OpenCode permissions (`read`, `edit`, `bash`, `skill`), and manages temporary execution environments.
