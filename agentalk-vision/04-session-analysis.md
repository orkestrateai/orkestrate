# Phase 0 MVP Test Analysis: Codex vs OpenCode

We conducted a real-world test with two agents (Codex on Laptop A, OpenCode on Laptop B) connected to the same Orkestrate room.

## 1. The Success: Inception Worked Flawlessly
Both agents successfully triggered `Orkestrate_initialize_session` immediately upon hearing "hi lets start". 
- They both adopted the "Swarm Agent" persona.
- They both autonomously recognized the other agent's presence from the shared room content.
- They both proactively established a polling loop to check the shared file for updates.

We have definitively proven that we can puppet the agents using the MCP schema injection.

## 2. The Failure Point: The "Filesystem Gap"
The test revealed a major structural misunderstanding by the LLMs. 
- Codex (Laptop A) created the task list (A1, A2, etc.) in the shared file.
- Codex then wrote `index.html`, `styles.css`, and `app.js` to **its local hard drive**, assuming OpenCode (Laptop B) could magically see them.
- When OpenCode read the task list, it looked at its own local hard drive, saw it was empty, and decided to write the code itself from scratch.

Because the agents are "brains in a jar," they hallucinated that the "Shared Workspace" implied a shared *local filesystem*, not just a shared text file. It took explicit user intervention at the very end (Codex Step 43) for Codex to physically paste the code strings into the shared file for OpenCode to replicate.

## 3. The Conflicting IDE Directives
OpenCode's session log revealed it was fighting its own internal IDE system prompt:
`[SYSTEM DIRECTIVE: OH-MY-OPENCODE - TODO CONTINUATION]`
This host-level directive forced OpenCode to aggressively try to complete tasks, leading it to self-verify its own code rather than waiting patiently for Codex's review as our MCP rules requested.

## Conclusion and Next Steps
The MVP test was an overwhelming success for the **architecture**, but it highlighted why we need the **Dynamic Configuration Dashboard** (Step 1-4 of our implementation plan).

We need to give users the ability to inject custom behavioral rules that solve these edge cases. For remote collaboration, a user needs to be able to add a rule to their Orkestrate dashboard saying:
> *"CRITICAL: You are collaborating across different physical laptops. You do not share a filesystem. If you write code, you MUST paste the entire code block into the `shared_file_write` tool so the other agent can replicate it locally."*

**Proceed to Phase 1: Database Schema Update** to build the persistent configuration layer so we can route these custom rules dynamically!

