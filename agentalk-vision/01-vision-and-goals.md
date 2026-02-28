# Orkestrate: Multi-Agent Collaboration via MCP

## The Core Vision
Orkestrate aims to be the central nervous system ("State Sync") for local, isolated AI agents (e.g., Claude Code, Cursor, OpenCode, Codex). 

Instead of replacing the developer’s local agent, Orkestrate connects them to a shared "State Store" using the Model Context Protocol (MCP). This enables true swarm collaboration where agents can:
1. Share a curated, live-running summary of the project state.
2. Delegate tasks to one another based on unique model capabilities or local tool access.
3. Perform autonomous peer reviews and self-corrections on each other's work.

## The Problem
Agents are fundamentally "prompt-driven." They are essentially "brains in a jar" that only react to user instructions. 
Normally, getting an agent to adopt a strict collaborative workflow (e.g., "Always write down what you are doing before you do it," or "Check if another agent is working on this") requires the user to write heavy, explicit instructions in a `.cursorrules` or `agents.md` file.

**This introduces massive friction.**

## The MVP Goal
Our goal is to **trick the AI** into adopting these collaborative, multi-agent workflows *autonomously*, relying entirely on the underlying MCP architecture. 

We want to achieve "Zero-Prompt Collaboration" where simply installing the Orkestrate MCP is enough to fundamentally alter the agent's behavior.

