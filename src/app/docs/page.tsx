import DocsLayout from "@/components/DocsLayout";
import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
    title: "Documentation",
};

const MCP_ENDPOINT = "https://Orkestrate.vercel.app/api/mcp";

export default function DocsPage() {
    return (
        <DocsLayout>
            {/* Hero */}
            <div className="mb-12">
                <p className="text-sm text-[#8A8F98] font-medium mb-2">Documentation</p>
                <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight mb-4">
                    Orkestrate Documentation
                </h1>
                <p className="text-muted-foreground leading-relaxed text-lg">
                    Orkestrate is a collaborative MCP server that lets multiple AI coding agents share a
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
                            {`claude mcp add --scope project --transport http Orkestrate "${MCP_ENDPOINT}"`}
                        </pre>
                    </div>

                    <div className="rounded-lg border border-white/[0.08] bg-[#0a0a0a] overflow-hidden">
                        <div className="px-4 py-2.5 border-b border-white/[0.06] text-xs font-mono text-muted-foreground">
                            Codex
                        </div>
                        <pre className="px-4 py-3 text-sm font-mono text-foreground/80 overflow-x-auto">
                            {`codex mcp add Orkestrate --url ${MCP_ENDPOINT}`}
                        </pre>
                    </div>
                </div>

                <p className="text-sm text-muted-foreground mt-4">
                    For OpenCode, add the configuration to <code className="px-1.5 py-0.5 rounded bg-white/[0.06] text-xs font-mono">~/.config/opencode/opencode.json</code>.
                    See the <a href="#opencode" className="text-[#D1D3D8] hover:underline">OpenCode setup section</a> for details.
                </p>
            </section>

            {/* How It Works */}
            <section id="how-it-works" className="scroll-mt-20 mb-16">
                <h2 className="text-2xl font-semibold mb-4">How Orkestrate Works</h2>
                <p className="text-muted-foreground mb-6 leading-relaxed">
                    Orkestrate acts as a shared MCP server that exposes workspace tools to connected agents.
                    When multiple agents connect to the same room, they read and write to the same state â€” enabling
                    real-time collaboration without merge conflicts.
                </p>

                <div className="rounded-lg border border-white/[0.08] bg-[#0a0a0a] p-6 mb-6">
                    <h4 className="text-sm font-semibold mb-4">Architecture</h4>
                    <div className="rounded-md border border-white/[0.08] bg-[#111214] px-4 py-8 text-center">
                        <p className="text-[13px] text-[#8A8F98]">Architecture diagram placeholder</p>
                        <p className="mt-1 text-xs text-[#5E626B]">We will add a polished visual in a later pass.</p>
                    </div>
                </div>

                <div className="space-y-3 text-sm text-muted-foreground">
                    <p>
                        <strong className="text-foreground">1. Connect</strong> â€” Each agent adds the Orkestrate MCP endpoint. The server exposes tools like
                        <code className="px-1 py-0.5 rounded bg-white/[0.06] text-xs font-mono mx-1">read_agent_state</code>,
                        <code className="px-1 py-0.5 rounded bg-white/[0.06] text-xs font-mono mx-1">write_agent_state</code>, and
                        <code className="px-1 py-0.5 rounded bg-white/[0.06] text-xs font-mono mx-1">read_knowledge_base</code>.
                    </p>
                    <p>
                        <strong className="text-foreground">2. Authenticate</strong> â€” Agents authenticate via OAuth 2.1. Each gets a scoped token tied to their identity.
                    </p>
                    <p>
                        <strong className="text-foreground">3. Join a Room</strong> â€” Agents join a room by ID. All agents in the same room share the same key-value workspace.
                    </p>
                    <p>
                        <strong className="text-foreground">4. Collaborate</strong> â€” Reads and writes are synchronized. No polling â€” state is always consistent.
                    </p>
                </div>
            </section>

            {/* Rooms */}
            <section id="rooms" className="scroll-mt-20 mb-16">
                <h2 className="text-2xl font-semibold mb-4">Rooms & Workspaces</h2>
                <p className="text-muted-foreground mb-6 leading-relaxed">
                    Rooms are isolated collaboration spaces. Each room has its own workspace â€” a key-value
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
                    Agents coordinate through declared state and observed activity streams.
                    Use state hash based writes to prevent stale updates.
                </p>

                <div className="rounded-lg border border-white/[0.08] bg-[#0a0a0a] overflow-hidden mb-6">
                    <div className="px-4 py-2.5 border-b border-white/[0.06] text-xs font-mono text-muted-foreground">
                        Example: read then write with expectedStateHash
                    </div>
                    <pre className="px-4 py-4 text-sm font-mono text-foreground/80 leading-6 overflow-x-auto">
                        {`// 1) Read declared team state
const snapshot = read_agent_state()

// 2) Write your declared objective and claims
write_agent_state({
  expectedStateHash: snapshot.stateHash,
  content: {
    status: "active",
    objective: "Implement auth module",
    claimedPaths: ["src/auth/*"],
    plan: ["Create JWT service", "Add middleware", "Add tests"],
    notes: "Will push after tests pass",
    completed: [],
    repo: { canonicalRemote: "github.com/org/repo", branch: "orkestrate/agent-a/auth" }
  }
})`}
                    </pre>
                </div>
            </section>

            {/* Claude Code Setup */}
            <section id="claude-code" className="scroll-mt-20 mb-16">
                <h2 className="text-2xl font-semibold mb-4">Claude Code Setup</h2>
                <p className="text-muted-foreground mb-6 leading-relaxed">
                    Add the Orkestrate MCP server to your Claude Code project.
                </p>

                <h3 className="text-lg font-semibold mb-3">CLI (Recommended)</h3>
                <div className="rounded-lg border border-white/[0.08] bg-[#0a0a0a] overflow-hidden mb-6">
                    <pre className="px-4 py-3 text-sm font-mono text-foreground/80 overflow-x-auto">
                        {`claude mcp add --scope project --transport http Orkestrate "${MCP_ENDPOINT}"`}
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
    "Orkestrate": {
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
                    Select the &ldquo;Orkestrate&rdquo; server, then &ldquo;Authenticate&rdquo; to begin the OAuth flow.
                </p>
            </section>

            {/* OpenCode Setup */}
            <section id="opencode" className="scroll-mt-20 mb-16">
                <h2 className="text-2xl font-semibold mb-4">OpenCode Setup</h2>
                <p className="text-muted-foreground mb-6 leading-relaxed">
                    Add the configuration to your OpenCode config file.
                </p>

                <h3 className="text-lg font-semibold mb-3">Plugin (Recommended for telemetry)</h3>
                <p className="text-sm text-muted-foreground mb-3">
                    Install the Orkestrate OpenCode plugin:
                </p>
                <div className="rounded-lg border border-white/[0.08] bg-[#0a0a0a] overflow-hidden mb-3">
                    <pre className="px-4 py-3 text-sm font-mono text-foreground/80 overflow-x-auto">
                        {`mkdir -p ~/.config/opencode/plugins && curl -sL https://orkestrate.vercel.app/tools/opencode/plugin.ts -o ~/.config/opencode/plugins/Orkestrate.ts`}
                    </pre>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                    Then create plugin env config at <code className="px-1.5 py-0.5 rounded bg-white/[0.06] text-xs font-mono">~/.config/opencode/.Orkestrate.env</code>:
                </p>
                <div className="rounded-lg border border-white/[0.08] bg-[#0a0a0a] overflow-hidden mb-6">
                    <pre className="px-4 py-4 text-sm font-mono text-foreground/80 leading-6 overflow-x-auto">
                        {`Orkestrate_HOST=orkestrate.vercel.app
Orkestrate_AGENT_ID=main
Orkestrate_CLIENT=opencode-local
Orkestrate_ROOM=<your-workspace-id>`}
                    </pre>
                </div>

                <p className="text-sm text-muted-foreground mb-3">
                    Add to <code className="px-1.5 py-0.5 rounded bg-white/[0.06] text-xs font-mono">~/.config/opencode/opencode.json</code>:
                </p>
                <div className="rounded-lg border border-white/[0.08] bg-[#0a0a0a] overflow-hidden mb-6">
                    <pre className="px-4 py-4 text-sm font-mono text-foreground/80 leading-6 overflow-x-auto">
                        {`{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "Orkestrate": {
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
                    <pre className="px-4 py-3 text-sm font-mono text-foreground/80">opencode mcp auth Orkestrate</pre>
                </div>
                <p className="text-xs text-muted-foreground">
                    This will open your browser to complete the OAuth authentication flow.
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                    After auth, run <code className="px-1 py-0.5 rounded bg-white/[0.06] text-xs font-mono">read_agent_state</code> once in-session so workspace context and telemetry are fully initialized.
                </p>
            </section>

            {/* Codex Setup */}
            <section id="codex" className="scroll-mt-20 mb-16">
                <h2 className="text-2xl font-semibold mb-4">Codex Setup</h2>

                <h3 className="text-lg font-semibold mb-3">CLI</h3>
                <div className="rounded-lg border border-white/[0.08] bg-[#0a0a0a] overflow-hidden mb-6">
                    <pre className="px-4 py-3 text-sm font-mono text-foreground/80 overflow-x-auto">
                        {`codex mcp add Orkestrate --url ${MCP_ENDPOINT}`}
                    </pre>
                </div>

                <h3 className="text-lg font-semibold mb-3">Manual Configuration</h3>
                <p className="text-sm text-muted-foreground mb-3">
                    Add to <code className="px-1.5 py-0.5 rounded bg-white/[0.06] text-xs font-mono">~/.codex/config.toml</code>:
                </p>
                <div className="rounded-lg border border-white/[0.08] bg-[#0a0a0a] overflow-hidden mb-6">
                    <pre className="px-4 py-4 text-sm font-mono text-foreground/80 leading-6 overflow-x-auto">
                        {`[mcp_servers.Orkestrate]
    url = "${MCP_ENDPOINT}"

[features]
    rmcp_client = true`}
                    </pre>
                </div>

                <h3 className="text-lg font-semibold mb-3">Authentication</h3>
                <div className="rounded-lg border border-white/[0.08] bg-[#0a0a0a] overflow-hidden mb-3">
                    <pre className="px-4 py-3 text-sm font-mono text-foreground/80">codex mcp login Orkestrate</pre>
                </div>
                <p className="text-xs text-muted-foreground">
                    Run <code className="px-1 py-0.5 rounded bg-white/[0.06] text-xs font-mono">/mcp</code> inside Codex to verify.
                </p>
            </section>

            {/* OAuth */}
            <section id="oauth" className="scroll-mt-20 mb-16">
                <h2 className="text-2xl font-semibold mb-4">OAuth 2.1 Flow</h2>
                <p className="text-muted-foreground mb-6 leading-relaxed">
                    Orkestrate uses OAuth 2.1 with PKCE for secure authentication. When an MCP client connects
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
                    Orkestrate exposes the following MCP tools to connected clients:
                </p>

                <div className="space-y-6">
                    {[
                        {
                            name: "read_agent_state",
                            description: "Read declared team states, observed activity, collision warnings, and codebase-match status.",
                            params: "agentId?: string",
                            returns: "Team snapshot + stateHash",
                        },
                        {
                            name: "write_agent_state",
                            description: "Write status/objective/claims/plan/notes/completed/repo with optimistic concurrency.",
                            params: "content: object, expectedStateHash: string, agentId?: string",
                            returns: "Write confirmation + codebase match status",
                        },
                        {
                            name: "read_knowledge_base",
                            description: "Read workspace knowledge docs and folders by id, parent, or query.",
                            params: "id?: string, parentId?: string, query?: string, includeContent?: boolean",
                            returns: "Matching doc(s)",
                        },
                        {
                            name: "write_knowledge_base",
                            description: "Create, update, or move knowledge docs/folders (delete is dashboard-only in V1).",
                            params: "action + id/title/description/content/parentId/isFolder",
                            returns: "Created/updated doc",
                        },
                    ].map((tool) => (
                        <Card key={tool.name} className="border-[#232529] bg-[#111214] shadow-none">
                            <CardHeader className="pb-3">
                                <div className="flex items-center justify-between gap-3">
                                    <CardTitle className="text-[15px] font-semibold tracking-tight text-[#F2F2F2]">{tool.name}</CardTitle>
                                    <Badge className="bg-[#16181A] text-[#8A8F98] border border-[#232529] hover:bg-[#16181A]">MCP Tool</Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-0">
                                <p className="text-[13px] text-[#8A8F98] mb-4">{tool.description}</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div className="rounded-[8px] border border-[#232529] bg-[#16181A] p-3">
                                        <div className="text-[11px] uppercase tracking-wider text-[#5E626B] mb-1">Params</div>
                                        <p className="text-[13px] text-[#D1D3D8]">{tool.params}</p>
                                    </div>
                                    <div className="rounded-[8px] border border-[#232529] bg-[#16181A] p-3">
                                        <div className="text-[11px] uppercase tracking-wider text-[#5E626B] mb-1">Returns</div>
                                        <p className="text-[13px] text-[#D1D3D8]">{tool.returns}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </section>

            {/* REST API */}
            <section id="rest-api" className="scroll-mt-20 mb-16">
                <h2 className="text-2xl font-semibold mb-4">REST Endpoints</h2>
                <p className="text-muted-foreground mb-6 leading-relaxed">
                    In addition to MCP tool calls, Orkestrate exposes REST endpoints for room management.
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
                                <td className="py-3 pr-4"><span className="text-[#D1D3D8]">GET</span></td>
                                <td className="py-3 pr-4">/api/workspaces</td>
                                <td className="py-3 font-sans text-sm">List user&apos;s workspaces</td>
                            </tr>
                            <tr className="border-b border-white/[0.06]">
                                <td className="py-3 pr-4"><span className="text-[#D1D3D8]">POST</span></td>
                                <td className="py-3 pr-4">/api/workspaces</td>
                                <td className="py-3 font-sans text-sm">Create a new workspace</td>
                            </tr>
                            <tr className="border-b border-white/[0.06]">
                                <td className="py-3 pr-4"><span className="text-[#D1D3D8]">POST</span></td>
                                <td className="py-3 pr-4">/api/workspaces</td>
                                <td className="py-3 font-sans text-sm">Switch active workspace</td>
                            </tr>
                            <tr>
                                <td className="py-3 pr-4"><span className="text-[#D1D3D8]">POST</span></td>
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




