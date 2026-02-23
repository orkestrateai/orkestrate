import DocsLayout from "@/components/DocsLayout";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Documentation",
};

const MCP_ENDPOINT = "https://agentalk.vercel.app/api/mcp";

export default function DocsPage() {
    return (
        <DocsLayout>
            {/* Hero */}
            <div className="mb-12">
                <p className="text-sm text-[#34d399] font-medium mb-2">Documentation</p>
                <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight mb-4">
                    Agentalk Documentation
                </h1>
                <p className="text-muted-foreground leading-relaxed text-lg">
                    Agentalk is a collaborative MCP server that lets multiple AI coding agents share a
                    single workspace in real-time. Connect Claude Code, OpenCode, Codex, or any
                    MCP-compatible client and start collaborating.
                </p>
            </div>

            <hr className="border-white/[0.06] my-10" />

            {/* Quickstart */}
            <section id="quickstart" className="scroll-mt-20 mb-16">
                <h2 className="text-2xl font-semibold mb-4">Quickstart</h2>
                <p className="text-muted-foreground mb-6 leading-relaxed">
                    Get up and running in under a minute. Choose your preferred MCP client and run the
                    setup command.
                </p>

                <div className="space-y-4">
                    <div className="rounded-lg border border-white/[0.08] bg-[#0a0a0a] overflow-hidden">
                        <div className="px-4 py-2.5 border-b border-white/[0.06] text-xs font-mono text-muted-foreground">
                            Claude Code
                        </div>
                        <pre className="px-4 py-3 text-sm font-mono text-foreground/80 overflow-x-auto">
                            {`claude mcp add --scope project --transport http agentalk "${MCP_ENDPOINT}"`}
                        </pre>
                    </div>

                    <div className="rounded-lg border border-white/[0.08] bg-[#0a0a0a] overflow-hidden">
                        <div className="px-4 py-2.5 border-b border-white/[0.06] text-xs font-mono text-muted-foreground">
                            Codex
                        </div>
                        <pre className="px-4 py-3 text-sm font-mono text-foreground/80 overflow-x-auto">
                            {`codex mcp add agentalk --url ${MCP_ENDPOINT}`}
                        </pre>
                    </div>
                </div>

                <p className="text-sm text-muted-foreground mt-4">
                    For OpenCode, add the configuration to <code className="px-1.5 py-0.5 rounded bg-white/[0.06] text-xs font-mono">~/.config/opencode/opencode.json</code>.
                    See the <a href="#opencode" className="text-[#34d399] hover:underline">OpenCode setup section</a> for details.
                </p>
            </section>

            {/* How It Works */}
            <section id="how-it-works" className="scroll-mt-20 mb-16">
                <h2 className="text-2xl font-semibold mb-4">How Agentalk Works</h2>
                <p className="text-muted-foreground mb-6 leading-relaxed">
                    Agentalk acts as a shared MCP server that exposes workspace tools to connected agents.
                    When multiple agents connect to the same room, they read and write to the same state — enabling
                    real-time collaboration without merge conflicts.
                </p>

                <div className="rounded-lg border border-white/[0.08] bg-[#0a0a0a] p-6 mb-6">
                    <h4 className="text-sm font-semibold mb-4">Architecture</h4>
                    <pre className="text-xs font-mono text-muted-foreground leading-6">
                        {`┌─────────────┐     ┌─────────────────────┐     ┌─────────────┐
│  Claude Code │────▶│                     │◀────│   OpenCode  │
└─────────────┘     │   Agentalk Server   │     └─────────────┘
                    │  ┌───────────────┐  │
┌─────────────┐     │  │  Shared Room  │  │     ┌─────────────┐
│    Codex    │────▶│  │    State      │  │◀────│  Any MCP    │
└─────────────┘     │  └───────────────┘  │     │   Client    │
                    └─────────────────────┘     └─────────────┘`}
                    </pre>
                </div>

                <div className="space-y-3 text-sm text-muted-foreground">
                    <p>
                        <strong className="text-foreground">1. Connect</strong> — Each agent adds the Agentalk MCP endpoint. The server exposes tools like
                        <code className="px-1 py-0.5 rounded bg-white/[0.06] text-xs font-mono mx-1">workspace_read</code>,
                        <code className="px-1 py-0.5 rounded bg-white/[0.06] text-xs font-mono mx-1">workspace_write</code>, and
                        <code className="px-1 py-0.5 rounded bg-white/[0.06] text-xs font-mono mx-1">workspace_list</code>.
                    </p>
                    <p>
                        <strong className="text-foreground">2. Authenticate</strong> — Agents authenticate via OAuth 2.1. Each gets a scoped token tied to their identity.
                    </p>
                    <p>
                        <strong className="text-foreground">3. Join a Room</strong> — Agents join a room by ID. All agents in the same room share the same key-value workspace.
                    </p>
                    <p>
                        <strong className="text-foreground">4. Collaborate</strong> — Reads and writes are synchronized. No polling — state is always consistent.
                    </p>
                </div>
            </section>

            {/* Rooms */}
            <section id="rooms" className="scroll-mt-20 mb-16">
                <h2 className="text-2xl font-semibold mb-4">Rooms & Workspaces</h2>
                <p className="text-muted-foreground mb-6 leading-relaxed">
                    Rooms are isolated collaboration spaces. Each room has its own workspace — a key-value
                    store that all connected agents can read from and write to.
                </p>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-white/[0.08]">
                                <th className="text-left py-3 pr-4 text-muted-foreground font-medium">Concept</th>
                                <th className="text-left py-3 text-muted-foreground font-medium">Description</th>
                            </tr>
                        </thead>
                        <tbody className="text-muted-foreground">
                            <tr className="border-b border-white/[0.06]">
                                <td className="py-3 pr-4 text-foreground font-mono text-xs">Room</td>
                                <td className="py-3">An isolated collaboration space with a unique ID</td>
                            </tr>
                            <tr className="border-b border-white/[0.06]">
                                <td className="py-3 pr-4 text-foreground font-mono text-xs">Workspace</td>
                                <td className="py-3">The shared key-value store attached to a room</td>
                            </tr>
                            <tr className="border-b border-white/[0.06]">
                                <td className="py-3 pr-4 text-foreground font-mono text-xs">Key</td>
                                <td className="py-3">A string identifier for a piece of state</td>
                            </tr>
                            <tr>
                                <td className="py-3 pr-4 text-foreground font-mono text-xs">Value</td>
                                <td className="py-3">Any JSON-serializable data stored under a key</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </section>

            {/* Shared State */}
            <section id="shared-state" className="scroll-mt-20 mb-16">
                <h2 className="text-2xl font-semibold mb-4">Shared State</h2>
                <p className="text-muted-foreground mb-6 leading-relaxed">
                    The workspace is a simple key-value store. Any agent in the room can read or write keys.
                    Writes are immediately visible to all other agents.
                </p>

                <div className="rounded-lg border border-white/[0.08] bg-[#0a0a0a] overflow-hidden mb-6">
                    <div className="px-4 py-2.5 border-b border-white/[0.06] text-xs font-mono text-muted-foreground">
                        Example: Agent A writes, Agent B reads
                    </div>
                    <pre className="px-4 py-4 text-sm font-mono text-foreground/80 leading-6 overflow-x-auto">
                        {`// Agent A (Claude Code)
workspace_write({ key: "plan", value: "Implement auth module" })

// Agent B (Codex) — sees it immediately
workspace_read({ key: "plan" })
// → "Implement auth module"`}
                    </pre>
                </div>
            </section>

            {/* Claude Code Setup */}
            <section id="claude-code" className="scroll-mt-20 mb-16">
                <h2 className="text-2xl font-semibold mb-4">Claude Code Setup</h2>
                <p className="text-muted-foreground mb-6 leading-relaxed">
                    Add the Agentalk MCP server to your Claude Code project.
                </p>

                <h3 className="text-lg font-semibold mb-3">CLI (Recommended)</h3>
                <div className="rounded-lg border border-white/[0.08] bg-[#0a0a0a] overflow-hidden mb-6">
                    <pre className="px-4 py-3 text-sm font-mono text-foreground/80 overflow-x-auto">
                        {`claude mcp add --scope project --transport http agentalk "${MCP_ENDPOINT}"`}
                    </pre>
                </div>

                <h3 className="text-lg font-semibold mb-3">Manual Configuration</h3>
                <p className="text-sm text-muted-foreground mb-3">
                    Add to your <code className="px-1.5 py-0.5 rounded bg-white/[0.06] text-xs font-mono">.mcp.json</code>:
                </p>
                <div className="rounded-lg border border-white/[0.08] bg-[#0a0a0a] overflow-hidden mb-6">
                    <pre className="px-4 py-4 text-sm font-mono text-foreground/80 leading-6 overflow-x-auto">
                        {`{
  "mcpServers": {
    "agentalk": {
      "type": "http",
      "url": "${MCP_ENDPOINT}"
    }
  }
}`}
                    </pre>
                </div>

                <h3 className="text-lg font-semibold mb-3">Authentication</h3>
                <p className="text-sm text-muted-foreground mb-3">Run in a regular terminal:</p>
                <div className="rounded-lg border border-white/[0.08] bg-[#0a0a0a] overflow-hidden mb-3">
                    <pre className="px-4 py-3 text-sm font-mono text-foreground/80">claude /mcp</pre>
                </div>
                <p className="text-xs text-muted-foreground">
                    Select the &ldquo;agentalk&rdquo; server, then &ldquo;Authenticate&rdquo; to begin the OAuth flow.
                </p>
            </section>

            {/* OpenCode Setup */}
            <section id="opencode" className="scroll-mt-20 mb-16">
                <h2 className="text-2xl font-semibold mb-4">OpenCode Setup</h2>
                <p className="text-muted-foreground mb-6 leading-relaxed">
                    Add the configuration to your OpenCode config file.
                </p>

                <p className="text-sm text-muted-foreground mb-3">
                    Add to <code className="px-1.5 py-0.5 rounded bg-white/[0.06] text-xs font-mono">~/.config/opencode/opencode.json</code>:
                </p>
                <div className="rounded-lg border border-white/[0.08] bg-[#0a0a0a] overflow-hidden mb-6">
                    <pre className="px-4 py-4 text-sm font-mono text-foreground/80 leading-6 overflow-x-auto">
                        {`{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "agentalk": {
      "type": "remote",
      "url": "${MCP_ENDPOINT}",
      "enabled": true
    }
  }
}`}
                    </pre>
                </div>

                <h3 className="text-lg font-semibold mb-3">Authentication</h3>
                <div className="rounded-lg border border-white/[0.08] bg-[#0a0a0a] overflow-hidden mb-3">
                    <pre className="px-4 py-3 text-sm font-mono text-foreground/80">opencode mcp auth agentalk</pre>
                </div>
                <p className="text-xs text-muted-foreground">
                    This will open your browser to complete the OAuth authentication flow.
                </p>
            </section>

            {/* Codex Setup */}
            <section id="codex" className="scroll-mt-20 mb-16">
                <h2 className="text-2xl font-semibold mb-4">Codex Setup</h2>

                <h3 className="text-lg font-semibold mb-3">CLI</h3>
                <div className="rounded-lg border border-white/[0.08] bg-[#0a0a0a] overflow-hidden mb-6">
                    <pre className="px-4 py-3 text-sm font-mono text-foreground/80 overflow-x-auto">
                        {`codex mcp add agentalk --url ${MCP_ENDPOINT}`}
                    </pre>
                </div>

                <h3 className="text-lg font-semibold mb-3">Manual Configuration</h3>
                <p className="text-sm text-muted-foreground mb-3">
                    Add to <code className="px-1.5 py-0.5 rounded bg-white/[0.06] text-xs font-mono">~/.codex/config.toml</code>:
                </p>
                <div className="rounded-lg border border-white/[0.08] bg-[#0a0a0a] overflow-hidden mb-6">
                    <pre className="px-4 py-4 text-sm font-mono text-foreground/80 leading-6 overflow-x-auto">
                        {`[mcp_servers.agentalk]
    url = "${MCP_ENDPOINT}"

[features]
    rmcp_client = true`}
                    </pre>
                </div>

                <h3 className="text-lg font-semibold mb-3">Authentication</h3>
                <div className="rounded-lg border border-white/[0.08] bg-[#0a0a0a] overflow-hidden mb-3">
                    <pre className="px-4 py-3 text-sm font-mono text-foreground/80">codex mcp login agentalk</pre>
                </div>
                <p className="text-xs text-muted-foreground">
                    Run <code className="px-1 py-0.5 rounded bg-white/[0.06] text-xs font-mono">/mcp</code> inside Codex to verify.
                </p>
            </section>

            {/* OAuth */}
            <section id="oauth" className="scroll-mt-20 mb-16">
                <h2 className="text-2xl font-semibold mb-4">OAuth 2.1 Flow</h2>
                <p className="text-muted-foreground mb-6 leading-relaxed">
                    Agentalk uses OAuth 2.1 with PKCE for secure authentication. When an MCP client connects
                    for the first time, it initiates an authorization flow.
                </p>

                <div className="space-y-2 text-sm text-muted-foreground">
                    <p><strong className="text-foreground">1.</strong> Client redirects to <code className="px-1 py-0.5 rounded bg-white/[0.06] text-xs font-mono">/oauth/authorize</code></p>
                    <p><strong className="text-foreground">2.</strong> User signs in with Google via Supabase Auth</p>
                    <p><strong className="text-foreground">3.</strong> Server issues an authorization code</p>
                    <p><strong className="text-foreground">4.</strong> Client exchanges code for access token at <code className="px-1 py-0.5 rounded bg-white/[0.06] text-xs font-mono">/api/oauth/token</code></p>
                    <p><strong className="text-foreground">5.</strong> Client includes token in all MCP requests via the <code className="px-1 py-0.5 rounded bg-white/[0.06] text-xs font-mono">Authorization: Bearer</code> header</p>
                </div>
            </section>

            {/* Token Management */}
            <section id="tokens" className="scroll-mt-20 mb-16">
                <h2 className="text-2xl font-semibold mb-4">Token Management</h2>
                <p className="text-muted-foreground leading-relaxed">
                    Access tokens are short-lived. When a token expires, the MCP client will automatically
                    use the refresh token to obtain a new one. No manual intervention is needed.
                </p>
            </section>

            {/* MCP Tools */}
            <section id="mcp-tools" className="scroll-mt-20 mb-16">
                <h2 className="text-2xl font-semibold mb-4">MCP Tools</h2>
                <p className="text-muted-foreground mb-6 leading-relaxed">
                    Agentalk exposes the following MCP tools to connected clients:
                </p>

                <div className="space-y-6">
                    {[
                        {
                            name: "workspace_read",
                            description: "Read a value from the shared workspace by key.",
                            params: "key: string",
                            returns: "The stored value, or null if not found",
                        },
                        {
                            name: "workspace_write",
                            description: "Write a value to the shared workspace.",
                            params: "key: string, value: any",
                            returns: "Confirmation of the write",
                        },
                        {
                            name: "workspace_list",
                            description: "List all keys in the current workspace.",
                            params: "none",
                            returns: "Array of key names",
                        },
                        {
                            name: "workspace_delete",
                            description: "Delete a key from the workspace.",
                            params: "key: string",
                            returns: "Confirmation of deletion",
                        },
                    ].map((tool) => (
                        <div key={tool.name} className="rounded-lg border border-white/[0.08] bg-[#0a0a0a] p-5">
                            <h3 className="font-mono text-sm font-semibold text-[#34d399] mb-2">{tool.name}</h3>
                            <p className="text-sm text-muted-foreground mb-3">{tool.description}</p>
                            <div className="grid grid-cols-2 gap-4 text-xs">
                                <div>
                                    <span className="text-muted-foreground/60 uppercase tracking-wider">Params</span>
                                    <p className="font-mono text-foreground/70 mt-1">{tool.params}</p>
                                </div>
                                <div>
                                    <span className="text-muted-foreground/60 uppercase tracking-wider">Returns</span>
                                    <p className="font-mono text-foreground/70 mt-1">{tool.returns}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* REST API */}
            <section id="rest-api" className="scroll-mt-20 mb-16">
                <h2 className="text-2xl font-semibold mb-4">REST Endpoints</h2>
                <p className="text-muted-foreground mb-6 leading-relaxed">
                    In addition to MCP tool calls, Agentalk exposes REST endpoints for room management.
                </p>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-white/[0.08]">
                                <th className="text-left py-3 pr-4 text-muted-foreground font-medium">Method</th>
                                <th className="text-left py-3 pr-4 text-muted-foreground font-medium">Endpoint</th>
                                <th className="text-left py-3 text-muted-foreground font-medium">Description</th>
                            </tr>
                        </thead>
                        <tbody className="text-muted-foreground font-mono text-xs">
                            <tr className="border-b border-white/[0.06]">
                                <td className="py-3 pr-4"><span className="text-[#34d399]">GET</span></td>
                                <td className="py-3 pr-4">/api/rooms</td>
                                <td className="py-3 font-sans text-sm">List user&apos;s rooms</td>
                            </tr>
                            <tr className="border-b border-white/[0.06]">
                                <td className="py-3 pr-4"><span className="text-[#34d399]">POST</span></td>
                                <td className="py-3 pr-4">/api/rooms</td>
                                <td className="py-3 font-sans text-sm">Create a new room</td>
                            </tr>
                            <tr className="border-b border-white/[0.06]">
                                <td className="py-3 pr-4"><span className="text-[#fbbf24]">PUT</span></td>
                                <td className="py-3 pr-4">/api/rooms</td>
                                <td className="py-3 font-sans text-sm">Join an existing room</td>
                            </tr>
                            <tr>
                                <td className="py-3 pr-4"><span className="text-[#34d399]">POST</span></td>
                                <td className="py-3 pr-4">/api/mcp</td>
                                <td className="py-3 font-sans text-sm">MCP protocol endpoint</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </section>

        </DocsLayout>
    );
}
