import DocsLayout from "@/components/DocsLayout";
import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "Documentation",
};

const MCP_ENDPOINT = "https://orkestrate.space/api/mcp";

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
          Orkestrate is a coordination engine for AI coding agents. It prevents
          file collisions by making agents declare their intent, claim file
          paths, and share state — all through a standard MCP server that
          connects to Claude Code, OpenCode, Codex, Cursor, and Windsurf.
        </p>
      </div>

      {/* Quickstart */}
      <section id="quickstart" className="scroll-mt-20 mb-8">
        <div className="text-[10px] uppercase tracking-widest text-zinc-600 mb-3">
          Quickstart
        </div>

        <div className="space-y-3">
          <code className="block text-[12px] font-mono text-zinc-300 bg-black/40 border border-white/[0.06] rounded px-3 py-2">
            claude mcp add --transport http --scope project Orkestrate
            "https://orkestrate.space/api/mcp"
          </code>
          <code className="block text-[12px] font-mono text-zinc-300 bg-black/40 border border-white/[0.06] rounded px-3 py-2">
            opencode mcp add
          </code>
          <code className="block text-[12px] font-mono text-zinc-300 bg-black/40 border border-white/[0.06] rounded px-3 py-2">
            codex mcp add Orkestrate --url https://orkestrate.space/api/mcp
          </code>
        </div>

        <p className="text-[11px] text-zinc-500 mt-4 leading-relaxed">
          Add Orkestrate as an MCP server to your AI tool. Authentication
          happens via OAuth when the tool first connects.
        </p>
      </section>

      <hr className="border-white/[0.06] my-10" />

      {/* How It Works */}
      <section id="how-it-works" className="scroll-mt-20 mb-16">
        <h2 className="text-2xl font-semibold mb-4">How It Works</h2>
        <p className="text-muted-foreground mb-6 leading-relaxed">
          Orkestrate is a workflow enforcement engine. When an agent connects,
          it receives a set of MCP tools and a system prompt that says:{" "}
          <em>
            call{" "}
            <code className="px-1 py-0.5 rounded bg-white/[0.06] font-mono text-xs">
              identify_intent
            </code>{" "}
            first, then follow{" "}
            <code className="px-1 py-0.5 rounded bg-white/[0.06] font-mono text-xs">
              nextRequiredTool
            </code>{" "}
            exactly.
          </em>{" "}
          The server enforces this with guards — every write tool call is
          checked against a state machine.
        </p>

        <div className="rounded-lg border border-white/[0.08] bg-[#0a0a0a] p-6 mb-6">
          <h4 className="text-sm font-semibold mb-4">Coordination Flow</h4>
          <pre className="text-sm font-mono text-foreground/70 leading-7 overflow-x-auto">
            {`User prompt → identify_intent (classify task)
                    ↓
           read_team_state (see other agents + get stateHash)
                    ↓
     claim_scope (reserve file paths — rejects overlaps)
                    ↓
       update_my_state (publish objective, footprint, plan)
                    ↓
                    [agent does actual work]
                    ↓
       update_my_state (progress checkpoints)
                    ↓
  release_scope (or publish empty footprint to auto-release)`}
          </pre>
        </div>

        <div className="space-y-3 text-sm text-muted-foreground">
          <p>
            <strong className="text-foreground">Intents</strong> — Every task is
            classified as implement, review, observe, delegate, assist, or
            handoff. Only implement and assist can claim file paths. Observe and
            review are read-only.
          </p>
          <p>
            <strong className="text-foreground">Scope claims</strong> — Before
            editing files, an agent claims specific paths (e.g.{" "}
            <code className="px-1 py-0.5 rounded bg-white/[0.06] font-mono text-xs">
              src/auth/**
            </code>
            ). If another agent has overlapping paths, the claim is{" "}
            <strong>hard rejected</strong>. The agent must re-read state and
            choose different paths.
          </p>
          <p>
            <strong className="text-foreground">State hash</strong> — Every
            mutation requires a{" "}
            <code className="px-1 py-0.5 rounded bg-white/[0.06] font-mono text-xs">
              stateHash
            </code>{" "}
            obtained from the last{" "}
            <code className="px-1 py-0.5 rounded bg-white/[0.06] font-mono text-xs">
              read_team_state
            </code>
            . If any agent has mutated since your last read, your hash is stale
            and you are forced to re-read. This prevents conflicts without
            distributed locks.
          </p>
        </div>
      </section>

      <hr className="border-white/[0.06] my-10" />

      {/* Workspaces */}
      <section id="workspaces" className="scroll-mt-20 mb-16">
        <h2 className="text-2xl font-semibold mb-4">Workspaces</h2>
        <p className="text-muted-foreground mb-6 leading-relaxed">
          A workspace is an isolated collaboration container. Each workspace has
          its own agents, knowledge base, and member roster. A workspace must be
          bound to a git repository for agents to join.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.08]">
                <th className="text-left py-3 pr-4 text-muted-foreground font-medium">
                  Concept
                </th>
                <th className="text-left py-3 text-muted-foreground font-medium">
                  Description
                </th>
              </tr>
            </thead>
            <tbody className="text-muted-foreground">
              <tr className="border-b border-white/[0.06]">
                <td className="py-3 pr-4 text-foreground font-mono text-xs">
                  Workspace
                </td>
                <td className="py-3">
                  An isolated collaboration container with a unique ID, bound to
                  one git repository
                </td>
              </tr>
              <tr className="border-b border-white/[0.06]">
                <td className="py-3 pr-4 text-foreground font-mono text-xs">
                  Agent
                </td>
                <td className="py-3">
                  A connected AI coding tool instance (OpenCode, Claude, Codex,
                  Cursor, Windsurf)
                </td>
              </tr>
              <tr className="border-b border-white/[0.06]">
                <td className="py-3 pr-4 text-foreground font-mono text-xs">
                  Member
                </td>
                <td className="py-3">
                  A user with access to the workspace (owner, admin, or member)
                </td>
              </tr>
              <tr className="border-b border-white/[0.06]">
                <td className="py-3 pr-4 text-foreground font-mono text-xs">
                  Agent State
                </td>
                <td className="py-3">
                  Coordination snapshot: objective, footprint (claimed paths),
                  plan, notes
                </td>
              </tr>
              <tr>
                <td className="py-3 pr-4 text-foreground font-mono text-xs">
                  Scope Claim
                </td>
                <td className="py-3">
                  A lease on specific file paths, preventing other agents from
                  editing them
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <hr className="border-white/[0.06] my-10" />

      {/* Troubleshooting */}
      <section id="troubleshooting" className="scroll-mt-20 mb-16">
        <h2 className="text-2xl font-semibold mb-4">Troubleshooting</h2>

        <div className="space-y-6">
          <div className="rounded-lg border border-white/[0.08] bg-[#0a0a0a] p-5">
            <h3 className="text-sm font-semibold mb-2 font-mono">
              Workspace missing repository binding
            </h3>
            <p className="text-sm text-muted-foreground">
              Your workspace has no git repository bound. Go to{" "}
              <strong className="text-foreground">
                Dashboard → Settings → Git
              </strong>{" "}
              and bind your repository. The repository URL must match your local
              git remote.
            </p>
          </div>

          <div className="rounded-lg border border-white/[0.08] bg-[#0a0a0a] p-5">
            <h3 className="text-sm font-semibold mb-2 font-mono">
              Repository mismatch
            </h3>
            <p className="text-sm text-muted-foreground">
              Your local git remote does not match the workspace&apos;s bound
              repository. Check{" "}
              <code className="px-1 py-0.5 rounded bg-white/[0.06] font-mono text-xs">
                git remote -v
              </code>{" "}
              and compare with the workspace repo in Settings → Git.
            </p>
          </div>

          <div className="rounded-lg border border-white/[0.08] bg-[#0a0a0a] p-5">
            <h3 className="text-sm font-semibold mb-2 font-mono">
              Not authenticated / 401
            </h3>
            <p className="text-sm text-muted-foreground">
              Your CLI session may have expired. Run{" "}
              <code className="px-1 py-0.5 rounded bg-white/[0.06] font-mono text-xs">
                orkestrate login
              </code>{" "}
              to re-authenticate. Check your status with{" "}
              <code className="px-1 py-0.5 rounded bg-white/[0.06] font-mono text-xs">
                orkestrate whoami
              </code>
              .
            </p>
          </div>

          <div className="rounded-lg border border-white/[0.08] bg-[#0a0a0a] p-5">
            <h3 className="text-sm font-semibold mb-2 font-mono">
              No active workspace
            </h3>
            <p className="text-sm text-muted-foreground">
              Run{" "}
              <code className="px-1 py-0.5 rounded bg-white/[0.06] font-mono text-xs">
                orkestrate init
              </code>{" "}
              in your project directory to detect your git repo and link it to a
              workspace. Or run{" "}
              <code className="px-1 py-0.5 rounded bg-white/[0.06] font-mono text-xs">
                orkestrate workspace create &lt;name&gt;
              </code>{" "}
              to create one manually.
            </p>
          </div>

          <div className="rounded-lg border border-white/[0.08] bg-[#0a0a0a] p-5">
            <h3 className="text-sm font-semibold mb-2 font-mono">
              Agent not appearing after connect
            </h3>
            <p className="text-sm text-muted-foreground">
              Restart your AI tool after running{" "}
              <code className="px-1 py-0.5 rounded bg-white/[0.06] font-mono text-xs">
                orkestrate connect &lt;tool&gt;
              </code>
              . The tool needs to reload its MCP configuration to pick up the
              new server.
            </p>
          </div>

          <div className="rounded-lg border border-white/[0.08] bg-[#0a0a0a] p-5">
            <h3 className="text-sm font-semibold mb-2 font-mono">
              Scope conflict
            </h3>
            <p className="text-sm text-muted-foreground">
              Another agent has claimed the file paths you need. This is normal
              — Orkestrate rejects overlapping claims to prevent collisions. Run{" "}
              <code className="px-1 py-0.5 rounded bg-white/[0.06] font-mono text-xs">
                orkestrate status
              </code>{" "}
              to see which agent holds the claim, or wait for them to finish and
              release it.
            </p>
          </div>
        </div>
      </section>

      <hr className="border-white/[0.06] my-10" />

      {/* MCP Tools */}
      <section id="mcp-tools" className="scroll-mt-20 mb-16">
        <h2 className="text-2xl font-semibold mb-4">MCP Tools</h2>
        <p className="text-muted-foreground mb-6 leading-relaxed">
          Orkestrate exposes 10 MCP tools to connected clients. The server
          enforces a strict workflow — agents must call tools in the order
          specified by{" "}
          <code className="px-1 py-0.5 rounded bg-white/[0.06] font-mono text-xs">
            nextRequiredTool
          </code>{" "}
          in each response.
        </p>

        <div className="space-y-6">
          {[
            {
              name: "identify_intent",
              description:
                "Classify the current task and create a workflow run.",
              when: "Call first for every new task-like user prompt.",
              why: "Selects the right workflow and unlocks write tools in the correct order.",
              params:
                "userPrompt: string, agentId?: string, forceIntent?: intent, chain?: intent[]",
              returns:
                "intentId, confidence, phase, nextRequiredTool, run context",
            },
            {
              name: "join_workspace",
              description: "Join a workspace and verify repository identity.",
              when: "Call at session start or reconnect.",
              why: "Coordination is blocked until the session and repo are verified.",
              params:
                "workspaceId?: string, agentId?: string, toolName?: string, gitContext: object",
              returns:
                "session id, verified repo metadata, policy, nextRequiredTool",
            },
            {
              name: "read_team_state",
              description:
                "Read all agents' state, active scope claims, and the CAS state hash.",
              when: "Call after identify_intent and after any hash mismatch.",
              why: "Provides the fresh stateHash required for all write tools.",
              params: "agentId?: string",
              returns: "agents, activeClaims, stateHash, nextRequiredTool",
            },
            {
              name: "claim_scope",
              description: "Claim repo paths with strict overlap rejection.",
              when: "Call before editing files, for editable intents only.",
              why: "Prevents concurrent edits on intersecting paths.",
              params:
                "expectedStateHash: string, paths: string[], ttlSeconds?: number, agentId?: string",
              returns: "claim id, lease expiry, updated workflow phase",
            },
            {
              name: "update_my_state",
              description:
                "Publish objective, footprint, plan, notes, and repo context.",
              when: "Call after claim and at progress checkpoints.",
              why: "Keeps shared state auditable. Empty footprint + done status auto-releases claims.",
              params:
                "content: object, expectedStateHash: string, agentId?: string",
              returns:
                "state write confirmation, new stateHash, nextRequiredTool",
            },
            {
              name: "release_scope",
              description: "Release one active scope claim by ID.",
              when: "Call on completion, handoff, or scope change.",
              why: "Unblocks teammates and completes the claim lifecycle.",
              params: "claimId: string, agentId?: string",
              returns: "release confirmation and updated workflow phase",
            },
            {
              name: "send_message",
              description:
                "Send a message to another agent or broadcast to @everyone.",
              when: "Use to coordinate handoffs, ask questions, or announce decisions.",
              why: "Direct agent-to-agent communication outside of state updates.",
              params: "toAgentId: string, message: string",
              returns: "message delivery confirmation",
            },
            {
              name: "read_messages",
              description:
                "Read all unread messages addressed to you or broadcast to @everyone.",
              when: "Call when systemAlerts indicates unread messages.",
              why: "Messages are auto-marked as read. Missed messages appear in systemAlerts.",
              params: "(none)",
              returns: "list of messages with sender, content, and timestamp",
            },
            {
              name: "read_knowledge_base",
              description:
                "Read workspace knowledge docs. Supports direct read, folder traversal, and search.",
              when: "Use to load project context, architecture decisions, or onboarding docs.",
              why: "Agents can query shared docs to understand project conventions.",
              params:
                "id?: string, parentId?: string|null, query?: string, includeContent?: boolean",
              returns:
                "list of matching docs with metadata (and content if requested)",
            },
            {
              name: "write_knowledge_base",
              description:
                "Create, update, move, or delete knowledge docs and folders.",
              when: "Use to document decisions, create onboarding guides, or organize knowledge.",
              why: "Shared knowledge base persists across sessions. Folder delete cascades descendants.",
              params:
                "action: create|update|move|delete, id?, title?, description?, content?, parentId?, isFolder?",
              returns: "doc or confirmation",
            },
          ].map((tool) => (
            <Card
              key={tool.name}
              className="border-[#232529] bg-[#111214] shadow-none"
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-[15px] font-semibold tracking-tight text-[#F2F2F2]">
                    {tool.name}
                  </CardTitle>
                  <Badge className="bg-[#16181A] text-[#8A8F98] border border-[#232529] hover:bg-[#16181A]">
                    MCP Tool
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-[13px] text-[#8A8F98] mb-4">
                  {tool.description}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                  <div className="rounded-[8px] border border-[#232529] bg-[#16181A] p-3">
                    <div className="text-[11px] uppercase tracking-wider text-[#5E626B] mb-1">
                      When
                    </div>
                    <p className="text-[13px] text-[#D1D3D8]">{tool.when}</p>
                  </div>
                  <div className="rounded-[8px] border border-[#232529] bg-[#16181A] p-3">
                    <div className="text-[11px] uppercase tracking-wider text-[#5E626B] mb-1">
                      Why
                    </div>
                    <p className="text-[13px] text-[#D1D3D8]">{tool.why}</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="rounded-[8px] border border-[#232529] bg-[#16181A] p-3">
                    <div className="text-[11px] uppercase tracking-wider text-[#5E626B] mb-1">
                      Params
                    </div>
                    <p className="text-[13px] text-[#D1D3D8]">{tool.params}</p>
                  </div>
                  <div className="rounded-[8px] border border-[#232529] bg-[#16181A] p-3">
                    <div className="text-[11px] uppercase tracking-wider text-[#5E626B] mb-1">
                      Returns
                    </div>
                    <p className="text-[13px] text-[#D1D3D8]">{tool.returns}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <hr className="border-white/[0.06] my-10" />

      {/* Claude Code Setup */}
      <section id="claude-code" className="scroll-mt-20 mb-16">
        <h2 className="text-2xl font-semibold mb-4">Claude Code Setup</h2>
        <p className="text-muted-foreground mb-6 leading-relaxed">
          Add the Orkestrate MCP server to your Claude Code project. The default
          Claude scope is
          <code className="px-1 py-0.5 rounded bg-white/[0.06] text-xs font-mono mx-1">
            local
          </code>
          ; this example uses
          <code className="px-1 py-0.5 rounded bg-white/[0.06] text-xs font-mono mx-1">
            project
          </code>
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
          Add to your{" "}
          <code className="px-1.5 py-0.5 rounded bg-white/[0.06] text-xs font-mono">
            .mcp.json
          </code>
          :
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
          Verify the server is registered, then open Claude Code and
          authenticate from the MCP panel.
        </p>
        <div className="rounded-lg border border-white/[0.08] bg-[#0a0a0a] overflow-hidden mb-3">
          <pre className="px-4 py-3 text-sm font-mono text-foreground/80">
            claude mcp list
          </pre>
        </div>
        <p className="text-xs text-muted-foreground">
          In an active Claude Code session, run{" "}
          <code className="px-1 py-0.5 rounded bg-white/[0.06] text-xs font-mono">
            /mcp
          </code>
          , select &ldquo;Orkestrate&rdquo;, then choose
          &ldquo;Authenticate&rdquo;.
        </p>
      </section>

      <hr className="border-white/[0.06] my-10" />

      {/* OpenCode Setup */}
      <section id="opencode" className="scroll-mt-20 mb-16">
        <h2 className="text-2xl font-semibold mb-4">OpenCode Setup</h2>
        <p className="text-muted-foreground mb-6 leading-relaxed">
          You can add the MCP server through CLI prompts or by editing your
          config file directly.
        </p>

        <h3 className="text-lg font-semibold mb-3">CLI (Recommended)</h3>
        <div className="rounded-lg border border-white/[0.08] bg-[#0a0a0a] overflow-hidden mb-3">
          <pre className="px-4 py-3 text-sm font-mono text-foreground/80">
            opencode mcp add
          </pre>
        </div>
        <p className="text-xs text-muted-foreground mb-6">
          In the prompt flow, set Name to{" "}
          <code className="px-1 py-0.5 rounded bg-white/[0.06] text-xs font-mono">
            Orkestrate
          </code>
          , Type to
          <code className="px-1 py-0.5 rounded bg-white/[0.06] text-xs font-mono mx-1">
            remote
          </code>
          , and URL to
          <code className="px-1 py-0.5 rounded bg-white/[0.06] text-xs font-mono mx-1">
            {MCP_ENDPOINT}
          </code>
          .
        </p>

        <h3 className="text-lg font-semibold mb-3">Manual Configuration</h3>
        <p className="text-sm text-muted-foreground mb-3">
          Add to{" "}
          <code className="px-1.5 py-0.5 rounded bg-white/[0.06] text-xs font-mono">
            ~/.config/opencode/opencode.json
          </code>
          :
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
          <pre className="px-4 py-3 text-sm font-mono text-foreground/80">
            opencode mcp auth Orkestrate
          </pre>
        </div>
        <p className="text-xs text-muted-foreground">
          This opens your browser for OAuth. Verify connection state with
          <code className="px-1 py-0.5 rounded bg-white/[0.06] text-xs font-mono mx-1">
            opencode mcp auth list
          </code>
          or
          <code className="px-1 py-0.5 rounded bg-white/[0.06] text-xs font-mono mx-1">
            opencode mcp list
          </code>
          .
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          After auth, run{" "}
          <code className="px-1 py-0.5 rounded bg-white/[0.06] text-xs font-mono">
            join_workspace
          </code>{" "}
          (or provide{" "}
          <code className="px-1 py-0.5 rounded bg-white/[0.06] text-xs font-mono">
            workspaceId
          </code>
          ) to activate this agent session.
        </p>
      </section>

      <hr className="border-white/[0.06] my-10" />

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
          Add to{" "}
          <code className="px-1.5 py-0.5 rounded bg-white/[0.06] text-xs font-mono">
            ~/.codex/config.toml
          </code>
          :
        </p>
        <div className="rounded-lg border border-white/[0.08] bg-[#0a0a0a] overflow-hidden mb-6">
          <pre className="px-4 py-4 text-sm font-mono text-foreground/80 leading-6 overflow-x-auto">
            {`[mcp_servers.Orkestrate]
    url = "${MCP_ENDPOINT}"`}
          </pre>
        </div>

        <h3 className="text-lg font-semibold mb-3">Authentication</h3>
        <div className="rounded-lg border border-white/[0.08] bg-[#0a0a0a] overflow-hidden mb-3">
          <pre className="px-4 py-3 text-sm font-mono text-foreground/80">
            codex mcp login Orkestrate
          </pre>
        </div>
        <p className="text-xs text-muted-foreground">
          Verify with{" "}
          <code className="px-1 py-0.5 rounded bg-white/[0.06] text-xs font-mono">
            codex mcp list
          </code>{" "}
          or run
          <code className="px-1 py-0.5 rounded bg-white/[0.06] text-xs font-mono mx-1">
            /mcp
          </code>{" "}
          inside Codex.
        </p>
      </section>

      <hr className="border-white/[0.06] my-10" />

      {/* OAuth */}
      <section id="oauth" className="scroll-mt-20 mb-16">
        <h2 className="text-2xl font-semibold mb-4">OAuth 2.1 Flow</h2>
        <p className="text-muted-foreground mb-6 leading-relaxed">
          Orkestrate uses OAuth 2.1 with PKCE for secure authentication. When an
          MCP client connects for the first time, it initiates an authorization
          flow.
        </p>

        <div className="space-y-2 text-sm text-muted-foreground">
          <p>
            <strong className="text-foreground">1.</strong> Client redirects to{" "}
            <code className="px-1 py-0.5 rounded bg-white/[0.06] text-xs font-mono">
              /oauth/authorize
            </code>
          </p>
          <p>
            <strong className="text-foreground">2.</strong> User signs in with
            Google via Supabase Auth
          </p>
          <p>
            <strong className="text-foreground">3.</strong> Server issues an
            authorization code
          </p>
          <p>
            <strong className="text-foreground">4.</strong> Client exchanges
            code for access token at{" "}
            <code className="px-1 py-0.5 rounded bg-white/[0.06] text-xs font-mono">
              /api/oauth/token
            </code>
          </p>
          <p>
            <strong className="text-foreground">5.</strong> Client includes
            token in all MCP requests via the{" "}
            <code className="px-1 py-0.5 rounded bg-white/[0.06] text-xs font-mono">
              Authorization: Bearer
            </code>{" "}
            header
          </p>
        </div>

        <h3 className="text-lg font-semibold mt-8 mb-3">Token Management</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Access tokens are short-lived (1 hour). When a token expires, the MCP
          client will automatically use the refresh token to obtain a new one.
          Refresh tokens rotate on each use and expire after 30 days. No manual
          intervention is needed.
        </p>
      </section>

      <hr className="border-white/[0.06] my-10" />

      {/* REST API */}
      <section id="rest-api" className="scroll-mt-20 mb-16">
        <h2 className="text-2xl font-semibold mb-4">REST Endpoints</h2>
        <p className="text-muted-foreground mb-6 leading-relaxed">
          In addition to MCP tool calls, Orkestrate exposes REST endpoints for
          workspace management and billing.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.08]">
                <th className="text-left py-3 pr-4 text-muted-foreground font-medium">
                  Method
                </th>
                <th className="text-left py-3 pr-4 text-muted-foreground font-medium">
                  Endpoint
                </th>
                <th className="text-left py-3 text-muted-foreground font-medium">
                  Description
                </th>
              </tr>
            </thead>
            <tbody className="text-muted-foreground font-mono text-xs">
              <tr className="border-b border-white/[0.06]">
                <td className="py-3 pr-4">
                  <span className="text-[#D1D3D8]">GET</span>
                </td>
                <td className="py-3 pr-4">/api/workspaces</td>
                <td className="py-3 font-sans text-sm">
                  List user&apos;s workspaces
                </td>
              </tr>
              <tr className="border-b border-white/[0.06]">
                <td className="py-3 pr-4">
                  <span className="text-[#D1D3D8]">POST</span>
                </td>
                <td className="py-3 pr-4">/api/workspaces</td>
                <td className="py-3 font-sans text-sm">
                  Create, rename, delete, switch, or bind-repo
                </td>
              </tr>
              <tr className="border-b border-white/[0.06]">
                <td className="py-3 pr-4">
                  <span className="text-[#D1D3D8]">GET</span>
                </td>
                <td className="py-3 pr-4">/api/knowledge</td>
                <td className="py-3 font-sans text-sm">
                  List or read knowledge docs
                </td>
              </tr>
              <tr className="border-b border-white/[0.06]">
                <td className="py-3 pr-4">
                  <span className="text-[#D1D3D8]">POST</span>
                </td>
                <td className="py-3 pr-4">/api/mcp</td>
                <td className="py-3 font-sans text-sm">
                  MCP JSON-RPC endpoint
                </td>
              </tr>
              <tr className="border-b border-white/[0.06]">
                <td className="py-3 pr-4">
                  <span className="text-[#D1D3D8]">GET</span>
                </td>
                <td className="py-3 pr-4">/api/payments/status</td>
                <td className="py-3 font-sans text-sm">
                  Current subscription and plan limits
                </td>
              </tr>
              <tr>
                <td className="py-3 pr-4">
                  <span className="text-[#D1D3D8]">GET</span>
                </td>
                <td className="py-3 pr-4">/api/health</td>
                <td className="py-3 font-sans text-sm">Server health check</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </DocsLayout>
  );
}
