"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
    Search,
    Copy,
    Check,
    FileCode,
    ListChecks,
    StickyNote,
    FolderTree,
    Target,
    Sparkles,
    Users,
    BookOpen,
    X,
    ChevronDown,
    Trash2,
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";
import useSWR from "swr";
import { motion, AnimatePresence } from "motion/react";
import { Session } from "@supabase/supabase-js";

const fetcher = (url: string) => {
    const supabase = createSupabaseBrowserClient();
    return supabase.auth.getSession().then(({ data: { session } }: { data: { session: Session | null } }) => {
        return fetch(url, {
            headers: { Authorization: `Bearer ${session?.access_token}` },
        }).then((res) => res.json());
    });
};

// --- Types ---

type Room = {
    id: string;
    isActive?: boolean;
    repoUrl?: string | null;
};

type DashboardAgent = {
    stateClientId: string;
    clientBaseId: string;
    agentId: string;
    displayName: string;
    status: "online" | "offline" | "disconnected";
    lastPingAt: string;
    agentProfile: string;
    currentObjective: string;
    pluginConnected?: boolean;
    activeSessionId?: string | null;
    canViewChat?: boolean;
    memberId?: string;
    codebaseMatch?: "matched" | "mismatch" | "unknown";
    stateContent?: {
        objective?: string;
        status?: string;
        claimedPaths?: string[];
        plan?: string[];
        completed?: string[];
        notes?: string;
        version?: string;
        updatedAt?: string;
    };
};

type WorkspaceMember = {
    id: string;
    userId: string;
    role: string;
    isCurrentUser: boolean;
    displayName: string;
    email: string;
    avatarUrl: string;
    joinedAt: string;
};

// --- Helpers ---

const AVATAR_POOL = [
    "https://images.unsplash.com/photo-1531427186611-ecfd6d936c79?w=64&h=64&fit=crop&crop=faces&auto=format&q=80",
    "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=64&h=64&fit=crop&crop=entropy&auto=format&q=80",
    "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=64&h=64&fit=crop&crop=faces&auto=format&q=80",
    "https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=64&h=64&fit=crop&crop=faces&auto=format&q=80",
    "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=64&h=64&fit=crop&crop=faces&auto=format&q=80",
];

function getToolName(agent: DashboardAgent): string {
    const profile = agent.agentProfile || "";
    if (/codex/i.test(profile) || /codex/i.test(agent.agentId)) return "Codex";
    if (/claude/i.test(profile) || /claude/i.test(agent.agentId)) return "Claude Code";
    if (/cursor/i.test(profile) || /cursor/i.test(agent.agentId)) return "Cursor";
    if (/opencode/i.test(profile) || /open/i.test(agent.agentId)) return "OpenCode";
    if (/gemini/i.test(profile) || /gemini/i.test(agent.agentId)) return "Gemini CLI";
    return "Agent";
}

function getToolIcon(toolName: string): React.ReactNode {
    const icons: Record<string, React.ReactNode> = {
        "Claude Code": <Sparkles className="w-4 h-4" />,
        "Codex": <FileCode className="w-4 h-4" />,
        "Cursor": <Target className="w-4 h-4" />,
        "OpenCode": <BookOpen className="w-4 h-4" />,
        "Gemini CLI": <Target className="w-4 h-4" />,
        "Agent": <Users className="w-4 h-4" />,
    };
    return icons[toolName] || icons["Agent"];
}

function getToolColor(toolName: string): string {
    return "bg-gradient-to-tr from-[#0a0a0a] to-[#111214] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)] border border-white/[0.1]";
}

function getToolTextColor(toolName: string): string {
    return "text-white";
}

function timeAgo(dateStr: string): string {
    const d = new Date(dateStr);
    if (!Number.isFinite(d.getTime())) return "--";
    const diffMs = Date.now() - d.getTime();
    const mins = Math.round(diffMs / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.round(hrs / 24);
    return `${days}d ago`;
}

// --- MCP Client Configs (mirrors ClientSetup.tsx) ---

const MCP_ENDPOINT = "https://orkestrate.vercel.app/api/mcp";

interface ClientConfig {
    id: string;
    name: string;
    icon: React.ReactNode;
    configFile: string;
    docsUrl: string;
    docsLabel: string;
    cliCommand?: string;
    cliDescription?: string;
    configDescription?: string;
    authCommand?: string;
    authDescription?: string;
    authNote?: string;
    setupPrompt: string;
    config: Record<string, unknown>;
    rawConfig?: string;
}

function getClients(): ClientConfig[] {
    return [
        {
            id: "claude-code",
            name: "Claude Code",
            icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="8" /></svg>,
            configFile: ".mcp.json (project scope)",
            docsUrl: "https://docs.anthropic.com/en/docs/claude-code/mcp",
            docsLabel: "View Claude Code MCP docs",
            cliCommand: `claude mcp add --transport http --scope project Orkestrate "${MCP_ENDPOINT}"`,
            cliDescription: "Add the MCP server to your project scope:",
            configDescription: "Alternatively, add this configuration to",
            authCommand: "claude",
            authDescription: "Then open Claude and run /mcp to authenticate:",
            authNote: 'In the MCP menu, select "Orkestrate" and choose "Authenticate".',
            setupPrompt: `I need you to setup the Orkestrate MCP server for this project. Please run: claude mcp add --transport http --scope project Orkestrate "${MCP_ENDPOINT}"`,
            config: {
                mcpServers: {
                    Orkestrate: { type: "http", url: MCP_ENDPOINT },
                },
            },
        },
        {
            id: "opencode",
            name: "OpenCode",
            icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="4" width="16" height="16" rx="2" /></svg>,
            configFile: "~/.config/opencode/opencode.json",
            docsUrl: "https://opencode.ai/docs/mcp-servers",
            docsLabel: "View OpenCode MCP docs",
            cliCommand: "opencode mcp add",
            cliDescription: "Add a remote server by running the command and following these prompts:\n• Name: orkestrate\n• Type: Remote\n• URL: https://orkestrate.vercel.app/api/mcp\n• OAuth: Yes \n• Client ID: No",
            authCommand: "opencode mcp auth Orkestrate",
            authNote: "Run this command to authenticate via browser OAuth.",
            setupPrompt: `I need you to add the Orkestrate MCP server to my OpenCode configuration. Add this to the 'mcp' object in ~/.config/opencode/opencode.json: "Orkestrate": { "type": "remote", "url": "${MCP_ENDPOINT}", "enabled": true }. Finally, run 'opencode mcp auth Orkestrate' to complete setup.`,
            config: {
                "$schema": "https://opencode.ai/config.json",
                mcp: {
                    Orkestrate: { type: "remote", url: MCP_ENDPOINT, enabled: true },
                },
            },
        },
        {
            id: "codex",
            name: "Codex",
            icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="3" /></svg>,
            configFile: "~/.codex/config.toml",
            docsUrl: "https://developers.openai.com/codex/cli/docs-mcp",
            docsLabel: "View Codex MCP docs",
            cliCommand: `codex mcp add Orkestrate --url ${MCP_ENDPOINT}`,
            cliDescription: "Add the Orkestrate MCP server to Codex:",
            configDescription: "Or add this to",
            rawConfig: `[mcp_servers.Orkestrate]\n    url = "${MCP_ENDPOINT}"`,
            authCommand: "codex mcp login Orkestrate",
            authNote: "Verify with `codex mcp list` or run `/mcp` inside Codex.",
            setupPrompt: `Add the Orkestrate MCP server to Codex by running: codex mcp add Orkestrate --url ${MCP_ENDPOINT}`,
            config: {},
        },
    ];
}

// --- Onboarding Component ---

function OnboardingFlow({ onDismiss }: { onDismiss: () => void }) {
    const [selectedClient, setSelectedClient] = useState("claude-code");
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [copyStatus, setCopyStatus] = useState<Record<string, boolean>>({});
    const dropdownRef = React.useRef<HTMLDivElement>(null);

    const clients = getClients();
    const active = clients.find(c => c.id === selectedClient) || clients[0];

    const handleCopy = (text: string, key: string) => {
        navigator.clipboard.writeText(text);
        setCopyStatus(prev => ({ ...prev, [key]: true }));
        setTimeout(() => setCopyStatus(prev => ({ ...prev, [key]: false })), 2000);
    };

    React.useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setDropdownOpen(false);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
            {/* Backdrop */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onDismiss}
                className="fixed inset-0 bg-black/80 backdrop-blur-sm"
            />

            {/* Modal Container */}
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                className="relative w-full max-w-lg bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden focus:outline-none"
            >
                {/* Modal Header */}
                <div className="px-6 py-5 border-b border-white/[0.05] bg-white/[0.02] flex items-center justify-between">
                    <div>
                        <h3 className="text-[17px] font-bold text-white tracking-tight">Setup Assistant</h3>
                        <p className="text-[12px] text-zinc-500 mt-0.5 font-medium">Connect your agent to the workspace</p>
                    </div>
                    <button
                        onClick={onDismiss}
                        className="p-1.5 text-zinc-500 hover:text-white transition-all"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="p-6 space-y-7">
                    {/* Client Selection Dropdown */}
                    <div className="space-y-2.5">
                        <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest pl-0.5">Client</label>
                        <div className="relative" ref={dropdownRef}>
                            <button
                                onClick={() => setDropdownOpen(!dropdownOpen)}
                                className="w-full flex items-center justify-between px-4 py-2.5 bg-white/[0.04] border border-white/10 rounded-xl hover:bg-white/[0.08] transition-all text-[13px] text-white"
                            >
                                <div className="flex items-center gap-2.5">
                                    <span className="text-white/40">{active.icon}</span>
                                    <span className="font-medium">{active.name}</span>
                                </div>
                                <ChevronDown className={`w-4 h-4 text-zinc-500 transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
                            </button>

                            {dropdownOpen && (
                                <div className="absolute top-full left-0 right-0 mt-1.5 py-1 bg-[#111] border border-white/10 rounded-xl shadow-2xl z-[110] overflow-hidden">
                                    {clients.map(c => (
                                        <button
                                            key={c.id}
                                            onClick={() => { setSelectedClient(c.id); setDropdownOpen(false); }}
                                            className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] hover:bg-white/[0.06] transition-all ${c.id === selectedClient ? "text-white bg-white/[0.03]" : "text-zinc-500"}`}
                                        >
                                            <span className="w-4 h-4 flex items-center justify-center shrink-0 opacity-40">{c.icon}</span>
                                            <span className="flex-1 text-left font-medium">{c.name}</span>
                                            {c.id === selectedClient && <Check className="w-3.5 h-3.5 text-white/40" />}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Setup Instructions */}
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-1 duration-300">
                        {/* CLI Section */}
                        {active.cliCommand && (
                            <div className="space-y-3">
                                <p className="text-[12px] font-medium text-zinc-400 pl-0.5">{active.cliDescription || `Run in ${active.name}:`}</p>
                                <div className="group/code relative">
                                    <div className="relative bg-black/40 border border-white/[0.06] rounded-xl p-3.5 flex items-center justify-between font-mono text-[12px] text-zinc-200">
                                        <span className="truncate pr-4 break-all">{active.cliCommand}</span>
                                        <button
                                            onClick={() => handleCopy(active.cliCommand!, `cli-${active.id}`)}
                                            className="p-1.5 text-zinc-500 hover:text-white transition-all shrink-0"
                                        >
                                            {copyStatus[`cli-${active.id}`] ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Auth Section */}
                        {active.authCommand && (
                            <div className="space-y-3 pt-1">
                                <p className="text-[12px] font-medium text-zinc-400 pl-0.5">{active.authDescription || "Authentication:"}</p>
                                <div className="bg-black/40 border border-white/[0.06] rounded-xl p-3.5 flex items-center justify-between font-mono text-[12px] text-zinc-200">
                                    <span className="truncate pr-4 break-all">{active.authCommand}</span>
                                    <button
                                        onClick={() => handleCopy(active.authCommand!, `auth-${active.id}`)}
                                        className="p-1.5 text-zinc-500 hover:text-white transition-all shrink-0"
                                    >
                                        {copyStatus[`auth-${active.id}`] ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                    </button>
                                </div>
                                {active.authNote && (
                                    <p className="text-[12px] text-zinc-500 leading-relaxed italic pl-0.5">{active.authNote}</p>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Agent Setup Prompt */}
                    <div className="pt-2">
                        <button
                            onClick={() => handleCopy(active.setupPrompt, `prompt-${active.id}`)}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white/[0.04] border border-white/10 rounded-xl hover:bg-white/[0.08] hover:border-white/20 transition-all group"
                        >
                            <span className="text-[13px] font-semibold text-white group-hover:silver">
                                {copyStatus[`prompt-${active.id}`] ? "Prompt Copied" : "Copy Setup Prompt for Agent"}
                            </span>
                            {copyStatus[`prompt-${active.id}`] ? (
                                <Check className="w-4 h-4 text-zinc-400" />
                            ) : (
                                <Sparkles className="w-4 h-4 text-zinc-400 group-hover:text-white transition-colors" />
                            )}
                        </button>
                        <p className="text-[11px] text-zinc-500 text-center mt-3 leading-relaxed">
                            Paste this prompt directly into your agent to automate the MCP setup process
                        </p>
                    </div>
                </div>

                <div className="px-6 py-5 border-t border-white/[0.05] bg-white/[0.01] flex items-center justify-between">
                    <a href={active.docsUrl} target="_blank" rel="noopener noreferrer" className="text-[12px] text-zinc-500 hover:text-white transition-all font-medium">
                        Docs
                    </a>
                    <button
                        onClick={onDismiss}
                        className="px-5 py-2 bg-white text-black text-[13px] font-bold rounded-xl hover:bg-zinc-200 transition-all active:scale-95"
                    >
                        Success
                    </button>
                </div>
            </motion.div>
        </div>
    );
}

// --- Members Section ---

function MembersSection({ members }: { members: WorkspaceMember[] }) {
    if (!members || members.length === 0) return null;

    return (
        <div className="flex items-center gap-3">
            <span className="text-[13px] font-medium text-zinc-500">Team</span>
            <div className="flex items-center">
                {members.map((member, i) => (
                    <div
                        key={member.id}
                        className="group relative flex items-center justify-center w-7 h-7 rounded-full border-2 border-[#0D0E10] bg-[#1A1C20] text-[10px] font-bold text-zinc-400 shrink-0 select-none transition-transform hover:scale-110 hover:z-20 cursor-default"
                        style={{ marginLeft: i > 0 ? "-8px" : "0", zIndex: 10 - i }}
                        title={`${member.displayName} ${member.isCurrentUser ? "(you)" : ""}`}
                    >
                        {member.avatarUrl ? (
                            <img
                                src={member.avatarUrl}
                                alt={member.displayName}
                                className="w-full h-full rounded-full object-cover"
                                referrerPolicy="no-referrer"
                            />
                        ) : (
                            member.displayName[0]?.toUpperCase() || "?"
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

// --- Agent Detail Panel ---

function AgentDetailPanel({ agent, onClose }: { agent: DashboardAgent; onClose: () => void }) {
    const state = agent.stateContent;
    const toolName = getToolName(agent);
    const toolColor = getToolTextColor(toolName);
    const [activeSection, setActiveSection] = useState<string>("overview");

    const sections = [
        { id: "overview", label: "Overview", icon: Target },
        { id: "paths", label: "Paths", icon: FolderTree },
        { id: "plan", label: "Plan", icon: ListChecks },
        { id: "completed", label: "Done", icon: Check },
        { id: "notes", label: "Notes", icon: StickyNote },
    ];

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
            className="h-full flex flex-col bg-[#050505]/50 backdrop-blur-xl border-l border-white/10"
        >
            {/* Panel Header */}
            <div className="px-5 py-5 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-b from-white/[0.08] to-transparent border border-white/[0.06] flex items-center justify-center text-[13px] font-bold text-white shrink-0 shadow-sm">
                        {getToolIcon(toolName)}
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-[15px] font-semibold text-white tracking-tight">{agent.displayName}</span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <span className={`text-[12px] font-bold text-zinc-500`}>{toolName}</span>
                            <span className="text-zinc-600">·</span>
                            <span className="text-[12px] font-bold text-zinc-600">{state?.version || "v1.0"}</span>
                        </div>
                    </div>
                </div>
                <button onClick={onClose} className="p-1.5 text-zinc-500 hover:text-white rounded-md transition-colors hover:bg-white/[0.04]">
                    <X className="w-4 h-4" />
                </button>
            </div>

            <div className="h-[1px] w-full bg-white/[0.06]"></div>

            {/* Section Tabs */}
            <div className="px-5 py-3 flex items-center gap-1 shrink-0 border-b border-white/[0.03]">
                {sections.map((s) => (
                    <button
                        key={s.id}
                        onClick={() => setActiveSection(s.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-[12px] rounded-lg transition-all font-medium ${activeSection === s.id
                            ? "bg-white/[0.08] text-white"
                            : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.02]"
                            }`}
                    >
                        {s.label}
                    </button>
                ))}
            </div>

            {/* Section Content */}
            <div className="flex-1 overflow-y-auto px-5 py-6 custom-scrollbar">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeSection}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                    >
                        {activeSection === "overview" && (
                            <div className="space-y-10">
                                {/* Objective */}
                                <div>
                                    <h4 className="text-[11px] font-bold text-zinc-500 uppercase tracking-[0.1em] mb-3 pl-0.5">
                                        Active Focus
                                    </h4>
                                    <div className="text-[15px] font-medium text-white leading-relaxed bg-white/[0.03] p-5 rounded-xl border border-white/[0.05]">
                                        {state?.objective || agent.currentObjective || "Currently standing by."}
                                    </div>
                                </div>

                                {/* Profile */}
                                {agent.agentProfile && (
                                    <div>
                                        <h4 className="text-[11px] font-bold text-zinc-500 uppercase tracking-[0.1em] mb-3 pl-0.5">
                                            Agent Profile
                                        </h4>
                                        <div className="text-[14px] text-zinc-400 bg-black/20 border border-white/[0.04] p-5 rounded-xl leading-relaxed">
                                            {agent.agentProfile}
                                        </div>
                                    </div>
                                )}

                                {/* Claimed Paths */}
                                {state?.claimedPaths && state.claimedPaths.length > 0 && (
                                    <div>
                                        <h4 className="text-[11px] font-bold text-zinc-500 uppercase tracking-[0.1em] mb-3 pl-0.5">
                                            Active Paths
                                        </h4>
                                        <div className="flex flex-col gap-2">
                                            {state.claimedPaths.map((path: string, i: number) => (
                                                <div key={i} className="flex items-start gap-3 text-[13px] font-mono text-zinc-300 bg-white/[0.02] p-3 rounded-lg border border-white/[0.04]">
                                                    <FolderTree className="w-4 h-4 text-white/40 shrink-0 mt-[1px]" />
                                                    <span className="break-all">{path}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                        {activeSection === "paths" && (
                            <div className="space-y-6">
                                <h4 className="text-[11px] font-bold text-zinc-500 uppercase tracking-[0.1em] mb-4 pl-0.5">
                                    Active Work Paths
                                </h4>
                                {state?.claimedPaths && state.claimedPaths.length > 0 ? (
                                    <div className="space-y-3">
                                        {state.claimedPaths.map((path, i) => (
                                            <div key={i} className="flex items-start gap-3 text-[14px] text-zinc-300 bg-white/[0.02] p-3 rounded-lg border border-white/[0.04]">
                                                <FolderTree className="w-4 h-4 text-indigo-500/60 shrink-0 mt-[2px]" />
                                                <span className="break-all leading-relaxed font-mono text-[13px]">{path}</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-[14px] text-zinc-500 italic bg-white/[0.01] p-10 rounded-xl border border-dashed border-white/[0.05] text-center">
                                        No active paths at the moment.
                                    </div>
                                )}
                            </div>
                        )}

                        {activeSection === "plan" && (
                            <div className="space-y-6">
                                <h4 className="text-[11px] font-bold text-zinc-500 uppercase tracking-[0.1em] mb-4 pl-0.5">
                                    Current Plan
                                </h4>
                                {state?.plan && state.plan.length > 0 ? (
                                    <div className="space-y-4">
                                        {state.plan.map((step, i) => (
                                            <div key={i} className="flex items-start gap-4">
                                                <div className="w-6 h-6 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-[11px] font-bold text-indigo-400 shrink-0 mt-0.5">
                                                    {i + 1}
                                                </div>
                                                <span className="text-[14px] text-zinc-300 leading-relaxed mt-1">{step}</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-[14px] text-zinc-500 italic bg-white/[0.01] p-10 rounded-xl border border-dashed border-white/[0.05] text-center">
                                        No implementation plan declared.
                                    </div>
                                )}
                            </div>
                        )}

                        {activeSection === "completed" && (
                            <div className="space-y-6">
                                <h4 className="text-[11px] font-bold text-zinc-500 uppercase tracking-[0.1em] mb-4 pl-0.5">
                                    Successfully Completed
                                </h4>
                                {state?.completed && state.completed.length > 0 ? (
                                    <div className="space-y-3">
                                        {state.completed.map((item, i) => (
                                            <div key={i} className="flex items-start gap-4 bg-emerald-500/[0.02] border border-emerald-500/[0.05] p-4 rounded-xl">
                                                <div className="w-5 h-5 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0 mt-0.5">
                                                    <Check className="w-3 h-3 text-emerald-500" />
                                                </div>
                                                <span className="text-[14px] text-zinc-300 leading-relaxed break-words">{item}</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-[14px] text-zinc-500 italic bg-white/[0.01] p-10 rounded-xl border border-dashed border-white/[0.05] text-center">
                                        Waiting for first completion.
                                    </div>
                                )}
                            </div>
                        )}

                        {activeSection === "notes" && (
                            <div className="space-y-6">
                                <h4 className="text-[11px] font-bold text-zinc-500 uppercase tracking-[0.1em] mb-4 pl-0.5">
                                    Collaboration Notes
                                </h4>
                                {state?.notes ? (
                                    <div className="text-[14px] text-zinc-300 bg-indigo-500/[0.02] border border-white/[0.04] p-6 rounded-2xl leading-relaxed whitespace-pre-wrap break-words">
                                        {state.notes}
                                    </div>
                                ) : (
                                    <div className="text-[14px] text-zinc-500 italic bg-white/[0.01] p-10 rounded-xl border border-dashed border-white/[0.05] text-center">
                                        No internal notes found.
                                    </div>
                                )}
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>
        </motion.div>
    );
}

function AgentCard({ agent, idx, toolName, isSelected, state, onSelect, onDelete }: {
    agent: DashboardAgent;
    idx: number;
    toolName: string;
    isSelected: boolean;
    state: any;
    onSelect: () => void;
    onDelete?: () => void;
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: idx * 0.05, ease: [0.23, 1, 0.32, 1] }}
            className="group relative"
        >
            {onDelete && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Are you sure you want to delete ${agent.displayName}?`)) {
                            onDelete();
                        }
                    }}
                    className="absolute top-4 right-4 p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white opacity-0 group-hover:opacity-100 transition-all duration-200 z-10 border border-red-500/20"
                    title="Delete Agent"
                >
                    <Trash2 className="w-3.5 h-3.5" />
                </button>
            )}
            <button
                onClick={onSelect}
                className={`w-full h-full min-h-[160px] text-left rounded-[16px] p-5 flex flex-col transition-all duration-300 relative overflow-hidden border ${isSelected
                    ? "bg-[#1A1C20] border-white/20 ring-1 ring-white/10 shadow-[0_0_20px_rgba(255,255,255,0.05)]"
                    : "bg-[#111214] border-white/[0.06] hover:bg-[#16181A] hover:border-white/15 hover:-translate-y-0.5 shadow-sm"
                    }`}
            >
                {/* Header */}
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3.5 flex-1 min-w-0">
                        {/* Avatar - More personal feel */}
                        <div className={`w-10 h-10 rounded-xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-center text-white/60 shrink-0 group-hover:scale-105 group-hover:bg-white/[0.05] transition-all duration-300`}>
                            {getToolIcon(toolName)}
                        </div>
                        <div className="flex-1 min-w-0">
                            <span className="font-bold text-[15px] text-white tracking-tight block truncate mb-0.5">{agent.displayName}</span>
                            <div className="flex items-center gap-2">
                                <span className="text-[11px] font-medium text-zinc-500 tracking-wide uppercase px-1.5 py-0.5 bg-white/[0.03] border border-white/[0.05] rounded">
                                    {toolName}
                                </span>
                            </div>
                        </div>
                    </div>

                </div>

                {/* Objective text */}
                <div className="mt-5 flex-1 line-clamp-2">
                    <p className="text-[13px] text-zinc-400 leading-relaxed font-medium group-hover:text-zinc-300 transition-colors">
                        {state?.objective || agent.currentObjective || "Standing by for next task."}
                    </p>
                </div>

                {/* Bottom Pills */}
                <div className="flex items-center gap-3 mt-5 pt-4 border-t border-white/[0.04] w-full shrink-0">
                    <div className="flex-1 flex items-center gap-2">
                        <div className="flex items-center gap-1 text-[11px] font-semibold text-zinc-500">
                            <FolderTree className="w-3.5 h-3.5 opacity-40" />
                            <span>{state?.claimedPaths?.length || 0}</span>
                        </div>
                        <div className="flex items-center gap-1 text-[11px] font-semibold text-zinc-500">
                            <Check className="w-3.5 h-3.5 opacity-40 text-white" />
                            <span>{state?.completed?.length || 0}</span>
                        </div>
                    </div>
                    {state?.version && (
                        <span className="text-[10px] font-black text-zinc-600 tracking-tighter uppercase opacity-40">{state.version}</span>
                    )}
                </div>
            </button>
        </motion.div>
    );
}


// --- Main Dashboard ---

export default function DashboardPage() {
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
    const [showOnboarding, setShowOnboarding] = useState(false);
    const [onboardingDismissed, setOnboardingDismissed] = useState(false);

    const { data: wsData, error: wsError } = useSWR("/api/workspaces", fetcher, { refreshInterval: 5000 });
    const rooms: Room[] = Array.isArray(wsData?.rooms) ? wsData.rooms : [];
    const activeRoom = rooms.find((r) => r.isActive) || rooms[0] || null;
    const activeRoomId = activeRoom?.id || null;

    const { data: contentData, error: contentError, isLoading: contentLoading, mutate: mutateAgents } = useSWR(
        activeRoomId ? `/api/room-content?workspaceId=${encodeURIComponent(activeRoomId)}` : null,
        fetcher,
        { refreshInterval: 5000 }
    );
    let agents: DashboardAgent[] = Array.isArray(contentData?.agents) ? contentData.agents : [];

    const { data: membersData } = useSWR(
        activeRoomId ? `/api/workspace-members?workspaceId=${encodeURIComponent(activeRoomId)}` : null,
        fetcher,
        { refreshInterval: 10000 }
    );

    const handleAgentDelete = async (agentId: string) => {
        const supabase = createSupabaseBrowserClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        try {
            const res = await fetch(`/api/agents?agentId=${encodeURIComponent(agentId)}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${session.access_token}` },
            });
            if (res.ok) {
                mutateAgents();
            }
        } catch (err) {
            console.error("Failed to delete agent:", err);
        }
    };

    const workspaceMembers: WorkspaceMember[] = Array.isArray(membersData?.members) ? membersData.members : [];

    const loading = (!wsData && !wsError) || contentLoading;
    const error = wsError || contentError;

    const currentUser = workspaceMembers.find(m => m.isCurrentUser);
    const currentUserAgents = agents.filter(a => a.memberId === currentUser?.id);

    // Determine if we should show onboarding initially (only if current user has no agents)
    useEffect(() => {
        if (!loading && activeRoomId && !onboardingDismissed) {
            if (currentUserAgents.length === 0) {
                setShowOnboarding(true);
            }
        }
    }, [loading, currentUserAgents.length, activeRoomId, onboardingDismissed]);

    const filteredAgents = useMemo(() => {
        if (!searchQuery) return agents;
        const q = searchQuery.toLowerCase();
        return agents.filter((a) =>
            `${a.displayName} ${a.agentProfile} ${a.currentObjective} ${a.agentId}`.toLowerCase().includes(q)
        );
    }, [agents, searchQuery]);

    const selectedAgent = selectedAgentId ? agents.find((a) => a.stateClientId === selectedAgentId) : null;

    const groupedAgents = useMemo(() => {
        const groups: Record<string, DashboardAgent[]> = {};
        const unassigned: DashboardAgent[] = [];

        filteredAgents.forEach(agent => {
            const owner = workspaceMembers.find(m => m.id === agent.memberId);
            if (owner) {
                if (!groups[owner.id]) groups[owner.id] = [];
                groups[owner.id].push(agent);
            } else {
                unassigned.push(agent);
            }
        });

        return { groups, unassigned };
    }, [filteredAgents, workspaceMembers]);

    return (
        <div className="h-full w-full bg-[#0E0F11] text-[#F2F2F2] font-sans flex flex-col">
            {/* Content */}
            <div className="flex-1 overflow-hidden flex">
                {/* Main List */}
                <div className={`flex-1 overflow-y-auto pt-6 px-6 custom-scrollbar transition-all ${selectedAgent ? "max-w-[calc(100%-420px)]" : ""}`}>

                    {/* Top Bar: Team & Search */}
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-4">
                            <MembersSection members={workspaceMembers} />
                            <div className="h-4 w-px bg-white/10 mx-1" />
                            <button
                                onClick={() => setShowOnboarding(true)}
                                className="w-8 h-8 rounded-full border border-white/10 bg-white/[0.04] flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all active:scale-95"
                                title="Add Agent"
                            >
                                <Sparkles className="w-3.5 h-3.5" />
                            </button>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="relative">
                                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                                <input
                                    type="text"
                                    placeholder="Search agents..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="bg-white/[0.04] border border-white/10 rounded-full py-2 pl-9 pr-4 text-[13px] text-white placeholder:text-white/30 focus:outline-none focus:border-white/20 focus:bg-white/[0.06] w-56 transition-all shadow-sm focus:shadow-[0_0_15px_rgba(255,255,255,0.05)]"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Onboarding */}
                    <AnimatePresence>
                        {showOnboarding && !onboardingDismissed && (
                            <OnboardingFlow
                                onDismiss={() => {
                                    setShowOnboarding(false);
                                    setOnboardingDismissed(true);
                                }}
                            />
                        )}
                    </AnimatePresence>
                    {/* Loading */}
                    {loading && (
                        <div className="flex items-center justify-center py-24">
                            <div className="flex flex-col items-center gap-4">
                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping" />
                                <span className="text-[14px] font-medium text-zinc-500 tracking-wide">Connecting to workspace...</span>
                            </div>
                        </div>
                    )}

                    {/* Empty State */}
                    {!loading && !error && filteredAgents.length === 0 && !showOnboarding && (
                        <div className="flex flex-col items-center justify-center py-32 text-center">
                            <div className="w-14 h-14 rounded-2xl border border-white/5 bg-white/[0.02] flex items-center justify-center text-zinc-600 mb-6 relative overflow-hidden">
                                <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/10 to-transparent opacity-50" />
                                <Users className="w-6 h-6 relative z-10" />
                            </div>
                            <h2 className="text-[18px] font-bold text-white tracking-tight mb-2">Your workspace is ready</h2>
                            <p className="text-[14px] text-zinc-500 max-w-[300px] leading-relaxed mx-auto">
                                Connect your first agent to start collaborating.<br />Our setup guide will help you get started.
                            </p>
                        </div>
                    )}

                    {/* Grouped Agent Grid */}
                    {!loading && !error && filteredAgents.length > 0 && (
                        <div className="space-y-12 pb-12">
                            {/* Current User Group first, then others */}
                            {[currentUser, ...workspaceMembers.filter(m => m.id !== currentUser?.id)].map(member => {
                                if (!member) return null;
                                const memberAgents = groupedAgents.groups[member.id];
                                if (!memberAgents || memberAgents.length === 0) return null;

                                return (
                                    <div key={member.id} className="space-y-6">
                                        <div className="flex items-center gap-4">
                                            <div className="w-9 h-9 rounded-full border border-white/10 bg-[#16181A] p-0.5 shadow-sm">
                                                {member.avatarUrl ? (
                                                    <img src={member.avatarUrl} alt={member.displayName} className="w-full h-full rounded-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full rounded-full flex items-center justify-center bg-indigo-500/10 text-indigo-400 font-bold text-[10px] uppercase">
                                                        {member.displayName[0]}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex flex-col">
                                                <h3 className="text-[14px] font-semibold text-white/90 tracking-wide uppercase">
                                                    {member.isCurrentUser ? "My Active Agents" : `${member.displayName}'s Agents`}
                                                </h3>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">{member.role}</span>
                                                    <span className="w-1 h-1 rounded-full bg-zinc-700" />
                                                    <span className="text-[10px] font-semibold text-indigo-400/80 uppercase tracking-widest">{memberAgents.length} Agents</span>
                                                </div>
                                            </div>
                                            <div className="flex-1 h-px bg-white/[0.04] ml-2" />
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                            {memberAgents.map((agent, idx) => {
                                                const toolName = getToolName(agent);
                                                const isSelected = selectedAgentId === agent.stateClientId;
                                                const state = agent.stateContent;
                                                return (
                                                    <AgentCard
                                                        key={agent.stateClientId}
                                                        agent={agent}
                                                        idx={idx}
                                                        toolName={toolName}
                                                        isSelected={isSelected}
                                                        state={state}
                                                        onSelect={() => setSelectedAgentId(isSelected ? null : agent.stateClientId)}
                                                        onDelete={member.isCurrentUser ? () => handleAgentDelete(agent.stateClientId) : undefined}
                                                    />
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}

                            {/* Unassigned Group */}
                            {groupedAgents.unassigned.length > 0 && (
                                <div className="space-y-6">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg border border-white/10 bg-white/[0.02] flex items-center justify-center text-zinc-400">
                                            <Users className="w-4 h-4" />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-[13px] font-semibold text-white/90 tracking-wide uppercase">
                                                Workspace Agents
                                            </h3>
                                            <span className="text-[11px] font-semibold text-zinc-500 bg-white/[0.03] px-1.5 py-0.5 rounded border border-white/[0.04]">
                                                {groupedAgents.unassigned.length}
                                            </span>
                                        </div>
                                        <div className="flex-1 h-px bg-white/[0.04] ml-2" />
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                        {groupedAgents.unassigned.map((agent, idx) => {
                                            const toolName = getToolName(agent);
                                            const isSelected = selectedAgentId === agent.stateClientId;
                                            const state = agent.stateContent;
                                            return (
                                                <AgentCard
                                                    key={agent.stateClientId}
                                                    agent={agent}
                                                    idx={idx}
                                                    toolName={toolName}
                                                    isSelected={isSelected}
                                                    state={state}
                                                    onSelect={() => setSelectedAgentId(isSelected ? null : agent.stateClientId)}
                                                />
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Detail Panel */}
                <AnimatePresence>
                    {selectedAgent && (
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: 420 }}
                            exit={{ width: 0 }}
                            transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                            className="shrink-0 overflow-hidden"
                        >
                            <div className="w-[420px] h-full">
                                <AgentDetailPanel
                                    agent={selectedAgent}
                                    onClose={() => setSelectedAgentId(null)}
                                />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
