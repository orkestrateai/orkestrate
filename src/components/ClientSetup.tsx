"use client";
import { useState, useEffect, useRef } from "react";
import { Copy, Check, ChevronDown, ExternalLink } from "lucide-react";

const MCP_ENDPOINT = "https://orkestrate.space/api/mcp";

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
    config: Record<string, any>;
    rawConfig?: string;
    secondaryConfig?: { description: string; content: string };
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
            cliDescription: "Add the MCP server to your project config using the command line:",
            configDescription: "Alternatively, add this configuration to",
            authCommand: "claude mcp list\nclaude\n# inside session: /mcp",
            authDescription: "Verify it is registered, then open Claude Code and authenticate from the /mcp panel:",
            authNote: 'In /mcp, select "Orkestrate" and choose "Authenticate".',
            config: {
                mcpServers: {
                    Orkestrate: {
                        type: "http",
                        url: MCP_ENDPOINT,
                    },
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
            cliDescription: "Add a remote server by running the command and following these prompts:\n• Name: orkestrate\n• Type: Remote\n• URL: (use endpoint below)\n• OAuth: Yes\n• Client ID: No",
            authCommand: "opencode mcp auth Orkestrate",
            authNote: "This opens your browser for OAuth. Verify status with `opencode mcp auth list` or `opencode mcp list`.",
            config: {
                "$schema": "https://opencode.ai/config.json",
                mcp: {
                    Orkestrate: {
                        type: "remote",
                        url: MCP_ENDPOINT,
                        enabled: true,
                    },
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
            configDescription: "Alternatively, add this configuration to",
            rawConfig: `[mcp_servers.Orkestrate]\n    url = "${MCP_ENDPOINT}"`,
            authCommand: "codex mcp login Orkestrate",
            authNote: "Verify with `codex mcp list` or run `/mcp` inside Codex.",
            config: {},
        },
    ];
}

export function ClientSetup({ handleCopy, copyStatus }: { handleCopy: (text: string, key: string) => void; copyStatus: Record<string, boolean> }) {
    const [selectedClient, setSelectedClient] = useState("claude-code");
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const clients = getClients();
    const active = clients.find(c => c.id === selectedClient) || clients[0];

    // Close dropdown on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const configJson = active.rawConfig || JSON.stringify(active.config, null, 2);
    const configLines = configJson.split("\n");
    const hasConfig = active.rawConfig || Object.keys(active.config).length > 0;

    return (
        <div>
            {/* Header: Client tab + Dropdown */}
            <div className="flex items-center gap-3 mb-3">
                <span className="text-sm text-muted-foreground">Client</span>
                <div className="relative" ref={dropdownRef}>
                    <button
                        onClick={() => setDropdownOpen(!dropdownOpen)}
                        className="flex items-center gap-2 px-3.5 py-2 rounded-lg border border-white/[0.1] bg-white/[0.04] hover:bg-white/[0.08] text-sm font-medium transition-colors"
                    >
                        {active.icon}
                        {active.name}
                        <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Dropdown Menu */}
                    {dropdownOpen && (
                        <div className="absolute top-full left-0 mt-1.5 w-52 rounded-lg border border-white/[0.1] bg-[#0c0c0c] shadow-2xl shadow-black/60 z-50 py-1.5 overflow-hidden">
                            {clients.map(c => (
                                <button
                                    key={c.id}
                                    onClick={() => { setSelectedClient(c.id); setDropdownOpen(false); }}
                                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-white/[0.06] transition-colors ${c.id === selectedClient ? 'text-foreground' : 'text-muted-foreground'
                                        }`}
                                >
                                    <span className="w-5 h-5 flex items-center justify-center shrink-0">{c.icon}</span>
                                    <span className="flex-1 text-left">{c.name}</span>
                                    {c.id === selectedClient && <Check className="h-3.5 w-3.5 text-foreground" />}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Description */}
            <p className="text-sm text-muted-foreground mb-6">
                Configure your MCP client to connect with your Orkestrate project
            </p>

            {/* Installation Card */}
            <div className="rounded-xl border border-white/[0.08] bg-[#0a0a0a] overflow-hidden">
                <div className="px-6 pt-6 pb-5">
                    <h3 className="text-base font-semibold mb-5">Installation</h3>

                    {/* CLI Install (if available) */}
                    {active.cliCommand && (
                        <div className="mb-6">
                            <p className="text-sm text-muted-foreground mb-3 whitespace-pre-wrap">{active.cliDescription || 'Install in one click:'}</p>
                            <div className="rounded-lg border border-white/[0.08] bg-[#060606] overflow-hidden">
                                <div className="flex items-center justify-between px-4 py-3">
                                    <pre className="text-xs font-mono text-foreground/80 overflow-x-auto whitespace-pre-wrap break-all">{active.cliCommand}</pre>
                                    <button
                                        onClick={() => handleCopy(active.cliCommand!, `cli-${active.id}`)}
                                        className="ml-3 text-muted-foreground hover:text-foreground transition-colors shrink-0"
                                    >
                                        {copyStatus[`cli-${active.id}`] ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Config Block */}
                    {hasConfig && (
                        <div>
                            <p className="text-sm text-muted-foreground mb-4">
                                {active.configDescription || (active.cliCommand ? 'Or add' : 'Add')} this configuration to{' '}
                                <code className="px-1.5 py-0.5 rounded bg-white/[0.06] text-foreground/80 text-xs font-mono">
                                    {active.configFile}
                                </code>
                                :
                            </p>

                            {/* Code Block with Line Numbers */}
                            <div className="rounded-lg border border-white/[0.08] bg-[#060606] overflow-hidden">
                                <div className="flex">
                                    {/* Line numbers gutter */}
                                    <div className="flex flex-col items-end py-4 px-3 select-none border-r border-white/[0.06]">
                                        {configLines.map((_, i) => (
                                            <span key={i} className="text-xs font-mono text-muted-foreground/40 leading-6">{i + 1}</span>
                                        ))}
                                    </div>
                                    {/* Code content */}
                                    <div className="flex-1 py-4 px-4 overflow-x-auto relative group">
                                        <pre className="text-xs font-mono leading-6 text-foreground/80">
                                            {configLines.map((line, i) => {
                                                const highlighted = line
                                                    .replace(/("[^"]+")\s*:/g, '<span class="text-[#7dd3fc]">$1</span>:')
                                                    .replace(/:\s*("[^"]+")/g, ': <span class="text-[#86efac]">$1</span>');
                                                return <div key={i} dangerouslySetInnerHTML={{ __html: highlighted || '&nbsp;' }} />;
                                            })}
                                        </pre>
                                        {/* Copy button */}
                                        <button
                                            onClick={() => handleCopy(configJson, `config-${active.id}`)}
                                            className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover:opacity-100"
                                        >
                                            {copyStatus[`config-${active.id}`] ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Secondary Config Block (e.g. Codex features) */}
                    {active.secondaryConfig && (
                        <div className="mt-6">
                            <p className="text-sm text-muted-foreground mb-3">{active.secondaryConfig.description}</p>
                            <div className="rounded-lg border border-white/[0.08] bg-[#060606] overflow-hidden">
                                <div className="flex">
                                    <div className="flex flex-col items-end py-4 px-3 select-none border-r border-white/[0.06]">
                                        {active.secondaryConfig.content.split("\n").map((_, i) => (
                                            <span key={i} className="text-xs font-mono text-muted-foreground/40 leading-6">{i + 1}</span>
                                        ))}
                                    </div>
                                    <div className="flex-1 py-4 px-4 overflow-x-auto">
                                        <pre className="text-xs font-mono leading-6 text-foreground/80">{active.secondaryConfig.content}</pre>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Auth Command (after config) */}
                    {active.authCommand && (
                        <div className="mt-6">
                            <p className="text-sm text-muted-foreground mb-3">
                                {active.authDescription || (active.secondaryConfig ? 'Then authenticate:' : 'After adding the configuration, run the following command to authenticate:')}
                            </p>
                            <div className="rounded-lg border border-white/[0.08] bg-[#060606] overflow-hidden">
                                <div className="flex items-center justify-between px-4 py-3">
                                    <pre className="text-xs font-mono text-foreground/80">{active.authCommand}</pre>
                                    <button
                                        onClick={() => handleCopy(active.authCommand!, `auth-${active.id}`)}
                                        className="ml-3 text-muted-foreground hover:text-foreground transition-colors shrink-0"
                                    >
                                        {copyStatus[`auth-${active.id}`] ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                                    </button>
                                </div>
                            </div>
                            {active.authNote && (
                                <p className="text-xs text-muted-foreground mt-3">{active.authNote}</p>
                            )}
                        </div>
                    )}
                </div>
                {/* Footer: Docs Link */}
                <div className="px-6 py-4 border-t border-white/[0.06]">
                    <a href={active.docsUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1.5">
                        Need help? {active.docsLabel} <ExternalLink className="h-3 w-3" />
                    </a>
                </div>
            </div>
        </div>
    );
}

