"use client";

import React, { useState } from 'react';
import {
    ChevronDown,
    RefreshCw,
    Terminal,
    Cpu,
    MemoryStick,
    Database,
    Clock,
    Shield,
    FileJson,
    ListTree
} from 'lucide-react';

const AGENT_DATA = {
    "Alpha": {
        tool: "OpenCode",
        status: "Active",
        uptime: "4h 12m",
        memory: "1.2 GB",
        contextUsed: "84,021 / 128,000 tokens",
        lastSync: "2s ago",
        state: {
            "identity": {
                "name": "Alpha",
                "role": "Lead Backend Coordinator",
                "system_prompt_version": "v1.4.2"
            },
            "active_context": {
                "current_task": "O-101 JWT Middleware",
                "locked_files": [
                    "src/middleware/auth.ts",
                    "src/tests/auth.test.ts"
                ],
                "recent_errors": []
            },
            "collaboration_memory": {
                "charlie_status": "Blocked on migration lock",
                "bravo_status": "Idle, ready for unit tests"
            },
            "permissions": {
                "fs_read": ["*"],
                "fs_write": ["src/middleware/*", "src/tests/*"],
                "shell_exec": ["test", "build", "lint"],
                "network": false
            }
        }
    }
};

export default function AgentStateRegistryPage() {
    const [activeTab, setActiveTab] = useState<'Raw JSON' | 'Parsed Tree'>('Raw JSON');
    // Using mock data for Alpha
    const data = AGENT_DATA["Alpha"];

    return (
        <div className="h-full w-full bg-[#111214] text-[#EBEBEB] font-sans flex flex-col">

            {/* Header: Agent Selector */}
            <div className="px-8 py-5 border-b border-[#232529] flex items-center justify-between shrink-0 bg-[#16181A]">
                <div className="flex items-center gap-4">
                    <h1 className="text-[16px] font-semibold tracking-tight text-[#F2F2F2]">State Registry</h1>
                    <div className="h-4 w-[1px] bg-[#232529] mx-2"></div>

                    {/* Mock Dropdown */}
                    <button className="flex items-center gap-2 bg-[#1A1C20] hover:bg-[#232529] border border-[#2A2D32] px-3 py-1.5 rounded-[6px] transition-colors shadow-sm">
                        <img
                            src="https://images.unsplash.com/photo-1531427186611-ecfd6d936c79?w=32&h=32&fit=crop&crop=faces&auto=format&q=80"
                            alt="Alpha"
                            className="w-5 h-5 rounded-full object-cover shadow-sm"
                        />
                        <span className="text-[13px] font-medium text-[#F2F2F2]">Alpha</span>
                        <ChevronDown className="w-3.5 h-3.5 text-[#8A8F98] ml-1" />
                    </button>

                    <span className="text-[12px] text-[#8A8F98] flex items-center gap-1.5 ml-2 cursor-help" title="Powered by OpenCode">
                        <Terminal className="w-3.5 h-3.5" />
                        OpenCode
                    </span>
                </div>

                <div className="flex items-center gap-3 text-[13px] text-[#8A8F98]">
                    <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        Last synced {data.lastSync}
                    </span>
                    <button className="flex items-center gap-1.5 hover:text-[#F2F2F2] transition-colors ml-2 bg-[#1A1C20] hover:bg-[#232529] border border-[#2A2D32] px-2.5 py-1.5 rounded-[6px] shadow-sm">
                        <RefreshCw className="w-3 h-3" />
                        Refresh
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">

                {/* Left Panel: Metrics & Quick Info */}
                <div className="w-full lg:w-[320px] bg-[#111214] border-r border-[#232529] p-6 flex flex-col gap-6 overflow-y-auto shrink-0">

                    <div>
                        <h3 className="text-[11px] font-semibold text-[#5E626B] uppercase tracking-wider mb-4">Runtime Metrics</h3>
                        <div className="space-y-3.5">
                            <MetricRow icon={MemoryStick} label="Host Memory" value={data.memory} />
                            <MetricRow icon={Database} label="Context Window" value={data.contextUsed} />
                            <MetricRow icon={Cpu} label="Status" value={data.status} valueColor="text-[#3FB950]" />
                            <MetricRow icon={Clock} label="Uptime" value={data.uptime} />
                        </div>
                    </div>

                    <div className="h-[1px] bg-[#232529] w-full" />

                    <div>
                        <h3 className="text-[11px] font-semibold text-[#5E626B] uppercase tracking-wider mb-4 flex items-center gap-2">
                            <Shield className="w-3.5 h-3.5" />
                            Active Permissions
                        </h3>
                        <div className="space-y-3">
                            <PermissionBadge target="fs_read" paths={data.state.permissions.fs_read} />
                            <PermissionBadge target="fs_write" paths={data.state.permissions.fs_write} />
                            <PermissionBadge target="shell_exec" paths={data.state.permissions.shell_exec} />
                        </div>
                    </div>
                </div>

                {/* Right Panel: State JSON Viewer */}
                <div className="flex-1 bg-[#1A1C20] flex flex-col relative overflow-hidden">

                    {/* View Tabs */}
                    <div className="absolute top-4 right-6 flex bg-[#111214] rounded-[6px] p-0.5 border border-[#232529] shadow-sm z-10">
                        {['Raw JSON', 'Parsed Tree'].map(t => (
                            <button
                                key={t}
                                onClick={() => setActiveTab(t as any)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 text-[12px] rounded-[4px] transition-colors ${activeTab === t
                                    ? 'bg-[#232529] text-[#F2F2F2] shadow-sm font-medium'
                                    : 'text-[#8A8F98] hover:text-[#D1D3D8]'
                                    }`}
                            >
                                {t === 'Raw JSON' ? <FileJson className="w-3.5 h-3.5" /> : <ListTree className="w-3.5 h-3.5" />}
                                {t}
                            </button>
                        ))}
                    </div>

                    {/* Editor Area */}
                    <div className="flex-1 overflow-auto p-6 pt-16 font-mono text-[13px] leading-relaxed relative selection:bg-[#5E6AD2]/30 selection:text-[#F2F2F2]">
                        {/* Line numbers mock purely for aesthetics */}
                        <div className="absolute left-0 top-0 bottom-0 w-12 bg-[#1A1C20] border-r border-[#232529] text-right py-16 pr-3 text-[#5E626B] select-none pointer-events-none text-[12px]">
                            {Array.from({ length: 40 }).map((_, i) => (
                                <div key={i} className="leading-relaxed">{i + 1}</div>
                            ))}
                        </div>

                        <div className="pl-10">
                            {/* Syntax highlighted JSON mock */}
                            <pre className="text-[#D1D3D8]">
                                {`{
  `}
                                <span className="text-[#5E6AD2]">"agent_id"</span>{`: `}<span className="text-[#D29922]">"alpha_core_01"</span>{`,
  `}
                                <span className="text-[#5E6AD2]">"state"</span>{`: {
    `}
                                <span className="text-[#5E6AD2]">"identity"</span>{`: {
      `}
                                <span className="text-[#5E6AD2]">"name"</span>{`: `}<span className="text-[#D29922]">"Alpha"</span>{`,
      `}
                                <span className="text-[#5E6AD2]">"role"</span>{`: `}<span className="text-[#D29922]">"Lead Backend Coordinator"</span>{`,
      `}
                                <span className="text-[#5E6AD2]">"system_prompt_version"</span>{`: `}<span className="text-[#D29922]">"v1.4.2"</span>{`
    },
    `}
                                <span className="text-[#5E6AD2]">"active_context"</span>{`: {
      `}
                                <span className="text-[#5E6AD2]">"current_task"</span>{`: `}<span className="text-[#D29922]">"O-101 JWT Middleware"</span>{`,
      `}
                                <span className="text-[#5E6AD2]">"locked_files"</span>{`: [
        `}
                                <span className="text-[#D29922]">"src/middleware/auth.ts"</span>{`,
        `}
                                <span className="text-[#D29922]">"src/tests/auth.test.ts"</span>{`
      ],
      `}
                                <span className="text-[#5E6AD2]">"recent_errors"</span>{`: []
    },
    `}
                                <span className="text-[#5E6AD2]">"collaboration_memory"</span>{`: {
      `}
                                <span className="text-[#5E6AD2]">"charlie_status"</span>{`: `}<span className="text-[#D29922]">"Blocked on migration lock"</span>{`,
      `}
                                <span className="text-[#5E6AD2]">"bravo_status"</span>{`: `}<span className="text-[#D29922]">"Idle, ready for unit tests"</span>{`
    }
  }
}`}
                            </pre>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}

function MetricRow({ icon: Icon, label, value, valueColor = "text-[#D1D3D8]" }: { icon: any, label: string, value: string, valueColor?: string }) {
    return (
        <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-[13px] text-[#8A8F98]">
                <Icon className="w-4 h-4 text-[#5E626B]" />
                {label}
            </span>
            <span className={`text-[13px] font-medium ${valueColor}`}>{value}</span>
        </div>
    );
}

function PermissionBadge({ target, paths }: { target: string, paths: string[] }) {
    return (
        <div className="bg-[#111214] border border-[#232529] rounded-[8px] overflow-hidden shadow-sm">
            <div className="bg-[#16181A] px-3 py-2 border-b border-[#232529] text-[12px] font-mono text-[#D1D3D8] flex items-center justify-between">
                <span>{target}</span>
                <span className="text-[11px] font-medium text-[#3FB950] bg-[#3FB950]/10 px-1.5 rounded-[4px]">Allowed</span>
            </div>
            <div className="p-2.5 space-y-1.5 flex flex-wrap gap-1.5">
                {paths.map(p => (
                    <div key={p} className="text-[11px] font-mono text-[#8A8F98] bg-[#1A1C20] px-2 py-1 rounded-[4px] border border-[#2A2D32]">
                        {p}
                    </div>
                ))}
            </div>
        </div>
    );
}
