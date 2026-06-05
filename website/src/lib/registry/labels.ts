import type { RegistryKind } from "./types";

export const KIND_LABELS: Record<RegistryKind, string> = {
  pack: "Pack",
  "profile-pack": "Pack",
  adapter: "Adapter",
  "skill-pack": "Skill",
  "mcp-pack": "MCP",
  "command-pack": "Command",
};

export const KIND_COLORS: Record<RegistryKind, string> = {
  pack: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
  "profile-pack": "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
  adapter: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  "skill-pack": "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  "mcp-pack": "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  "command-pack": "bg-rose-500/10 text-rose-400 border-rose-500/20",
};