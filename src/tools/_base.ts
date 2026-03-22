/**
 * Tool Adapter Interface
 *
 * Each supported tool (codex, opencode, claude) implements this interface.
 * The MCP handler delegates tool-specific prompt generation to adapters,
 * while shared logic (Phases 1-4, reconnection) lives in mcp-prompt.ts.
 */

export interface AgentContext {
    /** Canonical agent ID, e.g. "opencode-a5f2" */
    agentId: string;
    /** OAuth client ID */
    clientId: string;
    /** Workspace ID for coordination */
    workspaceId: string;
    /** Orkestrate host, e.g. "Orkestrate.vercel.app" */
    host: string;
}

export interface ToolAdapter {
    /** Tool family identifier, e.g. 'codex', 'opencode', 'claude' */
    family: string;

    /**
     * Build the Phase 0 telemetry setup instructions.
     * Each tool has its own mechanism (plugin, shell command, hooks, etc.)
     */
    buildPhase0Prompt(ctx: AgentContext): string;
}

/** Registry of all tool adapters, keyed by family name */
const adapterRegistry = new Map<string, ToolAdapter>();

export function registerToolAdapter(adapter: ToolAdapter): void {
    adapterRegistry.set(adapter.family, adapter);
}

/** Validate that a context value is safe for shell interpolation */
const SAFE_SHELL_VALUE = /^[a-zA-Z0-9._\-:]+$/;
export function sanitizeShellValue(value: string): string {
    if (!SAFE_SHELL_VALUE.test(value)) {
        throw new Error(`Unsafe value for shell interpolation: "${value}"`);
    }
    return value;
}

let adaptersLoaded = false;
function ensureAdaptersLoaded(): void {
    if (adaptersLoaded) return;
    adaptersLoaded = true;
    // Lazy-load adapters to avoid TDZ issues with ESM evaluation order
    require("./codex/prompt");
    require("./opencode/prompt");
    require("./claude/prompt");
}

export function getToolAdapter(family: string): ToolAdapter {
    ensureAdaptersLoaded();
    const adapter = adapterRegistry.get(family) ?? adapterRegistry.get("agent");
    if (!adapter) {
        throw new Error(
            `No tool adapter found for family "${family}" and no "agent" fallback is registered.`,
        );
    }
    return adapter;
}

