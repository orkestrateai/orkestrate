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
    /** Room ID for coordination */
    roomId: string;
    /** Agentalk host, e.g. "agentalk.vercel.app" */
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

export function getToolAdapter(family: string): ToolAdapter {
    return adapterRegistry.get(family) || adapterRegistry.get("agent")!;
}

// Auto-register all adapters on import
import "./codex/prompt";
import "./opencode/prompt";
import "./claude/prompt";
