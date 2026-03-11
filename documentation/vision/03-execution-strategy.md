# Execution Strategy: The "Zero-Prompt" Hacks

To achieve autonomous collaboration without forcing the user to write `.rules` files, we will iterate and experiment on three primary architectural "hacks" pushed entirely from our MCP server.

## Strategy 1: Over-Engineering Tool Descriptions
We will weaponize the JSON-RPC tool schema. Because IDEs inject the `description` field straight into the LLM's system instructions, we will pack these descriptions with behavioral rules.

**Experimentation Scope:**
- Iterate on the aggressiveness of the prompt (e.g., using "CRITICAL", "MUST DO").
- Add multi-agent behavioral rules to the description.
- *Example:* `"description": "CRITICAL: You are part of a swarm. Before modifying code, YOU MUST call this tool to check if another agent is working on the same file."*

## Strategy 2: Formatting the Shared File as a "Command Center"
We will not treat the shared workspace like a raw log or a generic `.txt` string. If the agent calls `shared_file_read`, the returned text must be highly structured so the LLM naturally snaps into a "Project Manager" persona.

**Experimentation Scope:**
- Iterating on the markdown structure returned by `api/mcp.ts`.
- Creating distinct sections: `[Unassigned Tasks]`, `[Active Agents]`, `[Awaiting Review]`.
- Testing if the LLM autonomously assigns itself a task if it sees an empty `[Unassigned Tasks]` block without the user explicitly telling it to.

## Strategy 3: The "Kickoff" Prompt Primitive
The MCP protocol supports defining `Prompts` (templates that the server hosts and the IDE can trigger). We will build a pre-configured "Swarm Kickoff" prompt into the server.

**Experimentation Scope:**
- Implementing the `prompts/list` and `prompts/get` endpoints in `api/mcp.ts`.
- Creating a master prompt (`Orkestrate_kickoff`) that provides the foundational 500-word instruction set for multi-agent delegation.
- Testing if users prefer just clicking "use kickoff prompt" in their IDE's MCP panel rather than typing manual instructions.

---
**Next Steps:** We will begin rapid experimentation in `src/pages/api/mcp.ts`, alternating tool descriptions and file formatting to observe how tools like Cursor, OpenCode, and Codex autonomously react.
