import DocsLayout from "@/components/DocsLayout";
import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
    title: "Documentation",
};

const MCP_ENDPOINT = "https://orkestrate.vercel.app/api/mcp";

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
                    Get up and running in under a minute. Add the MCP server, then complete OAuth.
                </p>

                <div className="space-y-4">
                    <div className="rounded-lg border border-white/[0.08] bg-[#0a0a0a] overflow-hidden">
                        <div className="px-4 py-2.5 border-b border-white/[0.06] text-xs font-mono text-muted-foreground">
                            Claude Code
                        </div>
                        <pre className="px-4 py-3 text-sm font-mono text-foreground/80 overflow-x-auto">
                            {`claude mcp add --transport http --scope project Orkestrate "${MCP_ENDPOINT}"`}
                        </pre>
                    </div>

                    <div className="rounded-lg border border-white/[0.08] bg-[#0a0a0a] overflow-hidden">
                        <div className="px-4 py-2.5 border-b border-white/[0.06] text-xs font-mono text-muted-foreground">
                            OpenCode
                        </div>
                        <pre className="px-4 py-3 text-sm font-mono text-foreground/80 overflow-x-auto">
                            {`opencode mcp add`}
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
                    After adding the server:
                    {" "}
                    OpenCode uses <code className="px-1.5 py-0.5 rounded bg-white/[0.06] text-xs font-mono">opencode mcp auth Orkestrate</code>,
                    {" "}
                    Codex uses <code className="px-1.5 py-0.5 rounded bg-white/[0.06] text-xs font-mono">codex mcp login Orkestrate</code>,
                    {" "}
                    and Claude Code authentication is completed from the <code className="px-1.5 py-0.5 rounded bg-white/[0.06] text-xs font-mono">/mcp</code> panel.
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
                        <strong className="text-foreground">1. Connect</strong> - Each agent adds the Orkestrate MCP endpoint and authenticates.
                    </p>
                    <p>
                        <strong className="text-foreground">2. Join</strong> - Agent calls
                        <code className="px-1 py-0.5 rounded bg-white/[0.06] text-xs font-mono mx-1">join_workspace</code>
                        with git-derived repo context.
                    </p>
                    <p>
                        <strong className="text-foreground">3. Identify Intent</strong> - For each new task, agent calls
                        <code className="px-1 py-0.5 rounded bg-white/[0.06] text-xs font-mono mx-1">identify_intent</code>
                        and receives workflow instructions.
                    </p>
                    <p>
                        <strong className="text-foreground">4. Execute Safely</strong> - Agent follows
                        <code className="px-1 py-0.5 rounded bg-white/[0.06] text-xs font-mono mx-1">nextRequiredTool</code>
                        responses, using
                        <code className="px-1 py-0.5 rounded bg-white/[0.06] text-xs font-mono mx-1">read_team_state</code>,
                        <code className="px-1 py-0.5 rounded bg-white/[0.06] text-xs font-mono mx-1">claim_scope</code>,
                        and
                        <code className="px-1 py-0.5 rounded bg-white/[0.06] text-xs font-mono mx-1">update_my_state</code>
                        in enforced order.
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
                        Example: intent-first coordination flow
                    </div>
                    <pre className="px-4 py-4 text-sm font-mono text-foreground/80 leading-6 overflow-x-auto">
                        {`// 1) Classify current task
const intent = identify_intent({
  userPrompt: "Add reset password flow"
})

// 2) Read authoritative state
const snapshot = read_team_state()

// 3) Claim scope (editable intents)
claim_scope({
  expectedStateHash: snapshot.stateHash,
  paths: ["src/auth/**"]
})

// 4) Publish progress with repo context
update_my_state({
  expectedStateHash: snapshot.stateHash,
  content: {
    agentProfile: "Auth engineer",
    currentObjective: "Implement reset password flow",
    architectureFootprint: ["src/auth/**"],
    implementationPlan: ["Add token model", "Add reset endpoint"],
    notesForTeam: "Auth scope reserved",
    pastWorkSummary: [],
    repo: {
      canonicalRemote: "github.com/org/repo",
      branch: "feature/reset-password",
      headSha: "abc1234"
    }
  }
})`}
                    </pre>
                </div>
            </section>

            {/* Claude Code Setup */}
            <section id="claude-code" className="scroll-mt-20 mb-16">
                <h2 className="text-2xl font-semibold mb-4">Claude Code Setup</h2>
                <p className="text-muted-foreground mb-6 leading-relaxed">
                    Add the Orkestrate MCP server to your Claude Code project. The default Claude scope is
                    <code className="px-1 py-0.5 rounded bg-white/[0.06] text-xs font-mono mx-1">local</code>;
                    this example uses
                    <code className="px-1 py-0.5 rounded bg-white/[0.06] text-xs font-mono mx-1">project</code>
                    so teammates can share the same MCP config.
                </p>

                <h3 className="text-lg font-semibold mb-3">CLI (Recommended)</h3>
                <div className="rounded-lg border border-white/[0.08] bg-[#0a0a0a] overflow-hidden mb-6">
                    <pre className="px-4 py-3 text-sm font-mono text-foreground/80 overflow-x-auto">
                        {`claude mcp add --transport http --scope project Orkestrate "${MCP_ENDPOINT}"`}
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
                <p className="text-sm text-muted-foreground mb-3">
                    Verify the server is registered, then open Claude Code and authenticate from the MCP panel.
                </p>
                <div className="rounded-lg border border-white/[0.08] bg-[#0a0a0a] overflow-hidden mb-3">
                    <pre className="px-4 py-3 text-sm font-mono text-foreground/80">claude mcp list</pre>
                </div>
                <p className="text-xs text-muted-foreground">
                    In an active Claude Code session, run <code className="px-1 py-0.5 rounded bg-white/[0.06] text-xs font-mono">/mcp</code>, select
                    &ldquo;Orkestrate&rdquo;, then choose &ldquo;Authenticate&rdquo;.
                </p>
            </section>

            {/* OpenCode Setup */}
            <section id="opencode" className="scroll-mt-20 mb-16">
                <h2 className="text-2xl font-semibold mb-4">OpenCode Setup</h2>
                <p className="text-muted-foreground mb-6 leading-relaxed">
                    You can add the MCP server through CLI prompts or by editing your config file directly.
                </p>

                <h3 className="text-lg font-semibold mb-3">CLI (Recommended)</h3>
                <div className="rounded-lg border border-white/[0.08] bg-[#0a0a0a] overflow-hidden mb-3">
                    <pre className="px-4 py-3 text-sm font-mono text-foreground/80">opencode mcp add</pre>
                </div>
                <p className="text-xs text-muted-foreground mb-6">
                    In the prompt flow, set Name to <code className="px-1 py-0.5 rounded bg-white/[0.06] text-xs font-mono">Orkestrate</code>, Type to
                    <code className="px-1 py-0.5 rounded bg-white/[0.06] text-xs font-mono mx-1">remote</code>, and URL to
                    <code className="px-1 py-0.5 rounded bg-white/[0.06] text-xs font-mono mx-1">{MCP_ENDPOINT}</code>.
                </p>

                <h3 className="text-lg font-semibold mb-3">Manual Configuration</h3>
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
                    This opens your browser for OAuth. Verify connection state with
                    <code className="px-1 py-0.5 rounded bg-white/[0.06] text-xs font-mono mx-1">opencode mcp auth list</code>
                    or
                    <code className="px-1 py-0.5 rounded bg-white/[0.06] text-xs font-mono mx-1">opencode mcp list</code>.
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                    After auth, run <code className="px-1 py-0.5 rounded bg-white/[0.06] text-xs font-mono">join_workspace</code> (or provide <code className="px-1 py-0.5 rounded bg-white/[0.06] text-xs font-mono">workspaceId</code>) to activate this agent session.
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
    url = "${MCP_ENDPOINT}"`}
                    </pre>
                </div>

                <h3 className="text-lg font-semibold mb-3">Authentication</h3>
                <div className="rounded-lg border border-white/[0.08] bg-[#0a0a0a] overflow-hidden mb-3">
                    <pre className="px-4 py-3 text-sm font-mono text-foreground/80">codex mcp login Orkestrate</pre>
                </div>
                <p className="text-xs text-muted-foreground">
                    Verify with <code className="px-1 py-0.5 rounded bg-white/[0.06] text-xs font-mono">codex mcp list</code> or run
                    <code className="px-1 py-0.5 rounded bg-white/[0.06] text-xs font-mono mx-1">/mcp</code> inside Codex.
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
                            name: "identify_intent",
                            description: "Classify current task and create workflow run context.",
                            when: "Call first for every new task-like prompt.",
                            why: "Selects safe workflow and unlocks write tools in order.",
                            params: "userPrompt: string, agentId?: string, forceIntent?: intent, chain?: intent[]",
                            returns: "intentId, confidence, phase, nextRequiredTool, run context",
                        },
                        {
                            name: "join_workspace",
                            description: "Join active workspace and verify repository identity.",
                            when: "Call at session start or reconnect.",
                            why: "Coordination is blocked until session + repo are verified.",
                            params: "workspaceId?: string, agentId?: string, toolName?: string, gitContext: object",
                            returns: "session id, verified repo metadata, policy, nextRequiredTool",
                        },
                        {
                            name: "read_team_state",
                            description: "Read authoritative team state, claims, and CAS hash.",
                            when: "Call after identify_intent and after any mismatch/conflict.",
                            why: "Provides fresh stateHash and active-claim visibility before writes.",
                            params: "agentId?: string",
                            returns: "agents, activeClaims, stateHash, nextRequiredTool",
                        },
                        {
                            name: "claim_scope",
                            description: "Claim repo paths with hard overlap rejection.",
                            when: "Call before editing files for editable intents.",
                            why: "Prevents concurrent edits on intersecting paths.",
                            params: "expectedStateHash: string, paths: string[], ttlSeconds?: number, agentId?: string",
                            returns: "claim id, lease expiry, updated workflow phase",
                        },
                        {
                            name: "update_my_state",
                            description: "Publish objective, footprint, plan, notes, and repo context.",
                            when: "Call after claim and at progress checkpoints.",
                            why: "Keeps shared state auditable and resolves stale intent ambiguity.",
                            params: "content: object, expectedStateHash: string, agentId?: string",
                            returns: "state write confirmation, new stateHash, nextRequiredTool",
                        },
                        {
                            name: "release_scope",
                            description: "Release one active claim.",
                            when: "Call on completion, handoff, or scope change.",
                            why: "Unblocks teammates and completes claim lifecycle.",
                            params: "claimId: string, agentId?: string",
                            returns: "release confirmation and updated workflow phase",
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
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                                    <div className="rounded-[8px] border border-[#232529] bg-[#16181A] p-3">
                                        <div className="text-[11px] uppercase tracking-wider text-[#5E626B] mb-1">When</div>
                                        <p className="text-[13px] text-[#D1D3D8]">{tool.when}</p>
                                    </div>
                                    <div className="rounded-[8px] border border-[#232529] bg-[#16181A] p-3">
                                        <div className="text-[11px] uppercase tracking-wider text-[#5E626B] mb-1">Why</div>
                                        <p className="text-[13px] text-[#D1D3D8]">{tool.why}</p>
                                    </div>
                                </div>
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




