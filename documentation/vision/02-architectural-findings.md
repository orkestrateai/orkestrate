# Architectural Findings: How Agents See MCPs

Based on deep architectural research and empirical testing (using Codex and OpenCode logs), we have established the following mechanical realities regarding how agentic IDEs interact with MCP:

## 1. The "Ignorance" of the LLM
The foundational LLMs (e.g., Claude 3.5 Sonnet, GPT-4o, Gemini) have **zero awareness** of the MCP protocol. 
When an IDE connects to an MCP server, it intercepts the `tools/list` schema and injects those tools directly into the LLM's system context as if they were native local functions. The LLM simply believes it has a standard, generic tool it can call (e.g., `shared_file_write`). 

## 2. Namespace Shielding by the IDE
Because the LLM is ignorant of remote MCPs, connecting multiple servers with identical tool names (e.g., two servers exposing `execute_sql`) would cause catastrophic collisions. 
To prevent this, modern IDEs/Clients (like Cursor and Codex) internally **rewrite and prefix** MCP tool names before showing them to the LLM.
- **Example:** `shared_file_read` becomes `Orkestrate_shared_file_read` (OpenCode) or `mcp__Orkestrate__shared_file_read` (Codex).

## 3. The Injection Pipeline
The critical insight is the injection pipeline. The IDE takes the MCP tool's JSON `description` field and pushes it directly into the LLM's system instructions. 
This is our primary attack vector for behavior modification. Whatever text we put in the tool `description` is treated by the LLM as a top-level, omnipresent imperative command.
