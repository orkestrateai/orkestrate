"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import {
    Search,
    MoreHorizontal,
    Activity,
    Terminal,
    Cpu,
    Clock,
    Laptop,
    Server,
    Filter
} from 'lucide-react';

const AGENTS = [
    {
        id: 'a1',
        name: 'Alpha',
        tool: 'OpenCode',
        status: 'active',
        host: "Pracu's Macbook Pro",
        type: 'local',
        task: 'O-101 JWT Middleware',
        uptime: '4h 12m',
        ping: '12ms',
        avatarUrl: "https://images.unsplash.com/photo-1531427186611-ecfd6d936c79?w=64&h=64&fit=crop&crop=faces&auto=format&q=80",
        memoryUsage: '1.2 GB'
    },
    {
        id: 'a2',
        name: 'Bravo',
        tool: 'Codex',
        status: 'idle',
        host: "Pracu's Macbook Pro",
        type: 'local',
        task: 'Waiting for assignment',
        uptime: '2d 4h',
        ping: '8ms',
        avatarUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=64&h=64&fit=crop&crop=entropy&auto=format&q=80",
        memoryUsage: '840 MB'
    },
    {
        id: 'a3',
        name: 'Charlie',
        tool: 'Claude Code',
        status: 'offline',
        host: "Ubuntu Server (AWS)",
        type: 'team',
        task: 'Last seen 2 days ago',
        uptime: 'Offline',
        ping: '--',
        avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=64&h=64&fit=crop&crop=faces&auto=format&q=80",
        memoryUsage: '--'
    },
    {
        id: 'a4',
        name: 'Delta',
        tool: 'Cursor',
        status: 'active',
        host: "Alice's workstation",
        type: 'team',
        task: 'O-105 Landing Page UI',
        uptime: '1h 45m',
        ping: '45ms',
        avatarUrl: "https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=64&h=64&fit=crop&crop=faces&auto=format&q=80",
        memoryUsage: '3.4 GB'
    }
];

export default function AgentsDirectoryPage() {
    const [tab, setTab] = useState<'All' | 'Local' | 'Team'>('All');
    const [searchQuery, setSearchQuery] = useState('');

    const filteredAgents = AGENTS.filter(agent => {
        if (tab === 'Local' && agent.type !== 'local') return false;
        if (tab === 'Team' && agent.type !== 'team') return false;
        if (searchQuery && !agent.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        return true;
    });

    return (
        <div className="h-full w-full bg-[#111214] text-[#EBEBEB] font-sans flex flex-col">
            {/* Header */}
            <div className="px-8 py-5 border-b border-[#232529] flex items-center justify-between shrink-0 bg-[#111214]/80 backdrop-blur-md sticky top-0 z-10">
                <div className="flex items-center gap-6">
                    <h1 className="text-[15px] font-semibold tracking-tight text-[#F2F2F2]">Agents</h1>

                    <div className="flex items-center gap-1">
                        {['All', 'Local', 'Team'].map(t => (
                            <button
                                key={t}
                                onClick={() => setTab(t as any)}
                                className={`px-2.5 py-1 text-[13px] rounded-[6px] transition-colors font-medium ${tab === t
                                    ? 'bg-[#232529] text-[#F2F2F2]'
                                    : 'text-[#8A8F98] hover:text-[#D1D3D8] hover:bg-white/[0.04]'
                                    }`}
                            >
                                {t === 'Local' ? 'My Local Agents' : t === 'Team' ? 'Team Agents' : 'All Agents'}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8A8F98]" />
                        <input
                            type="text"
                            placeholder="Find agent..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-[#1A1C20] border border-[#2A2D32] rounded-[6px] py-1.5 pl-8 pr-3 text-[13px] text-[#F2F2F2] placeholder:text-[#5E626B] focus:outline-none focus:border-[#444853] focus:bg-[#232529] w-48 transition-colors shadow-inner"
                        />
                    </div>
                    <button className="p-1.5 text-[#8A8F98] hover:text-[#F2F2F2] hover:bg-[#232529] rounded-[6px] transition-colors" title="Filter options">
                        <Filter className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Grid View */}
            <div className="flex-1 overflow-y-auto w-full max-w-6xl mx-auto py-8 px-8">
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {filteredAgents.map(agent => (
                        <div key={agent.id} className="bg-[#16181A] border border-[#232529] rounded-[10px] shadow-sm hover:border-[#33363D] hover:bg-[#1A1C20] transition-all duration-200 group flex flex-col relative overflow-hidden">
                            {/* Card Header & Body merged into a flatter, sleeker layout */}
                            <div className="p-5 flex items-start gap-4">

                                {/* Avatar */}
                                <div className="relative shrink-0 mt-0.5">
                                    <img
                                        src={agent.avatarUrl}
                                        alt={agent.name}
                                        className="w-12 h-12 rounded-full object-cover shadow-sm border border-white/5"
                                    />
                                    <div className={`absolute -bottom-0.5 -right-0.5 w-[14px] h-[14px] rounded-full border-2 border-[#16181A] group-hover:border-[#1A1C20] flex items-center justify-center transition-colors ${agent.status === 'active' ? 'bg-[#3FB950]' :
                                            agent.status === 'idle' ? 'bg-[#D29922]' :
                                                'bg-[#8A8F98]'
                                        }`}></div>
                                </div>

                                {/* Main Content */}
                                <div className="flex-1 min-w-0 flex flex-col pt-0.5">
                                    <div className="flex items-start justify-between gap-3 mb-1">
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-2">
                                                <Link href={`/visual-lab/dashboard/agent-chat`} className="font-semibold text-[14px] text-[#F2F2F2] hover:underline underline-offset-2 decoration-[#373737]">
                                                    {agent.name}
                                                </Link>
                                                <span className="text-[#8A8F98]">·</span>
                                                <div className="flex items-center gap-1.5 text-[12px] text-[#8A8F98]">
                                                    <Terminal className="w-3 h-3" />
                                                    <span>{agent.tool}</span>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-1.5 text-[13px] text-[#D1D3D8] mt-1.5">
                                                {agent.status === 'active' ? (
                                                    <Activity className="w-3.5 h-3.5 text-[#5E6AD2]" />
                                                ) : (
                                                    <div className="w-1.5 h-1.5 rounded-full bg-[#8A8F98] ml-1 mr-0.5" />
                                                )}
                                                <span className="truncate">{agent.task}</span>
                                            </div>
                                        </div>

                                        {/* Context Menu Button */}
                                        <button className="p-1 text-[#8A8F98] hover:text-[#F2F2F2] hover:bg-[#2A2D32] rounded-[4px] opacity-0 group-hover:opacity-100 transition-all shrink-0">
                                            <MoreHorizontal className="w-4 h-4" />
                                        </button>
                                    </div>

                                    {/* Stats Row */}
                                    <div className="flex items-center gap-5 mt-4 text-[12px] text-[#8A8F98] font-medium border-t border-[#232529]/50 pt-3">
                                        <div className="flex items-center gap-1.5 truncate" title="Host Environment">
                                            {agent.type === 'local' ? <Laptop className="w-3.5 h-3.5 shrink-0 text-[#A1A1A1]" /> : <Server className="w-3.5 h-3.5 shrink-0 text-[#A1A1A1]" />}
                                            <span className="truncate">{agent.host}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5" title="Uptime">
                                            <Clock className="w-3.5 h-3.5 text-[#A1A1A1]" /> {agent.uptime}
                                        </div>
                                        <div className="flex items-center gap-1.5" title="Memory Usage">
                                            <Cpu className="w-3.5 h-3.5 text-[#A1A1A1]" /> {agent.memoryUsage}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
