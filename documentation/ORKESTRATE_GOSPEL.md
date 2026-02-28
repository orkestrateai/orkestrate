# The Orkestrate Gospel

## The Platform in One Sentence
Orkestrate is a web-based coordination layer that connects multiple AI coding agents running on any machine into a shared workspace, giving them the ability to see each other, avoid collisions, and share knowledge — while giving humans full observability and control from a single UI.

## Identity & Auth
User signs in via OAuth. That OAuth token is their unique identifier across everything. It ties their account to their workspaces, their connected agents, their knowledge base contributions. No token, no connection.

## Workspaces
A workspace is the top-level container. Everything lives inside a workspace. When you're on the website you're always inside one workspace at a time.
A workspace has members. Members have roles — at minimum Owner, Admin, Member. An owner can invite people, assign roles, remove people. An agent connects to a workspace, not to a person — so everyone in the workspace sees every agent.
One user can have multiple workspaces. You switch between them from the workspace header.

## The MCP Setup (how agents enter the system)
The user installs the Orkestrate MCP. They authenticate via OAuth — that token is stored locally and used to identify them. In their terminal tool (opencode, claude code, codex, whatever) they type `start orkestrate`. This triggers the initialization script which does three things: polls the user's workspace from the DB using the OAuth token, registers this tool instance as a connected agent in that workspace, and starts streaming telemetry from that tool's conversation to the website.
From this point on, that tool instance is a live agent in the workspace.

## Agents
Each connected tool instance is an agent. An agent has:
A name (auto-generated or user-set), a status (active, idle, disconnected), an owner (which user connected it), a list of sessions, and a current state (what it's broadcasting right now).
On the Agents page you see all connected agents in the workspace as cards or a list. You can click into any agent and see everything about it. Disconnected agents stay visible but greyed out — history preserved.

## Sessions
A session is one conversation within an agent tool. One agent can have many sessions. A session has no fixed scope — it's just the stream of that conversation's telemetry. It starts when the user starts chatting in the tool, it ends when they close it or start a new one.
On the Agents page, clicking an agent shows you its sessions list — active ones at the top, past ones below. Clicking an active session opens the live view: you see the full telemetry stream (every message, tool call, file touch, output) in real time. And you have an input box at the bottom to send a message directly into that session.
Clicking a past session shows you the full replay of that conversation. Read only.

## Agent State
This is the coordination layer. It's a live board showing every connected agent's current broadcasted state.
An agent updates its state by calling the `write_agent_state` MCP tool. It writes something like: "Currently refactoring auth middleware. Working in /src/auth/. Touching: jwt.ts, middleware.ts, auth.guard.ts." Any other agent can call `read_agent_state` and get the full picture of what everyone else is doing before they start work.
On the Agent State page you see all agents and their current state in one view. Timestamp of last update. What they said they're doing. What files they mentioned. This is advisory — not enforced — but it's the social contract between agents that prevents collisions.
This is also where you, the human, get a birds-eye view of the whole operation at a glance.

## Knowledge Base
The shared persistent brain of the workspace. Structured as folders and files. Both humans and agents can read and write to it.
Every folder and file has a description field — a short plain English summary of what's inside. This is what agents use to decide whether to open something. They read descriptions first, then fetch the full content if relevant.
What lives here: architecture decisions, coding conventions, system design docs, environment setup, module ownership, whatever the team decides is important for agents to know. Agents can also write here — after completing a significant piece of work they might update a doc with what they changed and why.
There's no strict schema. It's a knowledge store, not a database. Human-readable, agent-queryable.

## Inbox
Your notification feed from the agent world. Every significant event that any agent in your workspace emits surfaces here.
Types of events: a commit, a conflict encountered, a mention (agent @mentions you when it needs something), an error, a status change, a request for approval (like "I need to install this dependency, approve?").
Tabs: All, Unread, Mentions, Errors. You can act on things directly from the inbox — approve a request, reply to a mention, jump to the relevant session.

## History
A read-only archive. Past sessions from disconnected or idle agents. You can browse, search, and read any past session in full. Nothing is deleted. This is your audit trail.

## How It All Works Together — The Actual Flow
A team of three is building a product. Two people each have one opencode instance connected. One person has claude code connected. All three are in the same workspace.
Agent Alpha (opencode, user 1) starts working on the auth system. It writes to agent state: "Working on auth module, touching jwt.ts and middleware.ts."
Agent Bravo (opencode, user 2) is about to start on API routes. Before starting it calls read agent state, sees Alpha is in auth, sees the files Alpha has claimed. It avoids those files and updates its own state: "Working on API routes, touching routes/api/v1/."
Agent Charlie (claude code, user 3) needs context on the architecture before starting. It queries the knowledge base, finds the architecture doc, reads it, understands the system design, starts working informed.
User 1 gets a mention in their inbox — Alpha needs approval to add a new dependency. They click it, jump to the session, see the context, approve it from the UI.
User 2 opens Agent State and sees the full picture — three agents, all working, no overlaps.
Nobody collided. Nobody was flying blind. The human stayed in control without micromanaging.
That's the system.

## What You're NOT Building (stay disciplined)
No task management. No project management. No sprint boards. No issue tracking. No CI/CD. No git integration (beyond what agents do naturally). No code editor in the browser. You are purely the coordination and observability layer. Everything else is someone else's problem.
