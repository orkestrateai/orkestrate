"use client";

import React, { useState } from 'react';
import {
    Search,
    History,
    Terminal,
    Clock,
    Calendar,
    ChevronRight,
    MessageSquare,
    Play
} from 'lucide-react';

const PAST_SESSIONS = [
    {
        id: 's1',
        title: 'Debug Local Auth Server',
        date: 'Today, 10:24 AM',
        duration: '45m',
        agent: { name: 'Alpha', avatar: 'https://images.unsplash.com/photo-1531427186611-ecfd6d936c79?w=32&h=32&fit=crop&crop=faces&auto=format&q=80', tool: 'OpenCode' },
        turns: 24,
        summary: 'Traced a JWT signing issue to a missing environment variable in the local .env.local file.',
        status: 'completed'
    },
    {
        id: 's2',
        title: 'Setup initial Prisma Schema',
        date: 'Yesterday, 3:15 PM',
        duration: '1h 20m',
        agent: { name: 'Charlie', avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=32&h=32&fit=crop&crop=faces&auto=format&q=80', tool: 'Claude Code' },
        turns: 42,
        summary: 'Created the User, Team, and AgentSession models. Ran initial migration against local Postgres loopback.',
        status: 'completed'
    },
    {
        id: 's3',
        title: 'Review landing page copy',
        date: 'Oct 22, 2026',
        duration: '15m',
        agent: { name: 'Bravo', avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=32&h=32&fit=crop&crop=entropy&auto=format&q=80', tool: 'Codex' },
        turns: 4,
        summary: 'Brainstormed taglines for the Orkestrate platform hero section.',
        status: 'interrupted'
    }
];

export default function PastSessionsPage() {
    const [searchQuery, setSearchQuery] = useState('');

    return (
        <div className="h-full w-full bg-[#111214] text-[#EBEBEB] font-sans flex flex-col">
            {/* Header */}
            <div className="px-8 py-5 border-b border-[#232529] flex items-center justify-between shrink-0 bg-[#16181A]">
                <div className="flex items-center gap-3 text-[#EBEBEB]">
                    <History className="w-5 h-5 text-[#8A8F98]" />
                    <h1 className="text-[16px] font-semibold tracking-tight text-[#F2F2F2]">Past Sessions</h1>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8A8F98]" />
                        <input
                            type="text"
                            placeholder="Search transcripts..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-[#1A1C20] border border-[#2A2D32] rounded-[6px] py-1.5 pl-8 pr-3 text-[13px] text-[#F2F2F2] placeholder:text-[#5E626B] focus:outline-none focus:border-[#444853] focus:bg-[#232529] w-64 transition-colors shadow-inner"
                        />
                    </div>
                </div>
            </div>

            {/* List View */}
            <div className="flex-1 overflow-y-auto p-8 max-w-4xl w-full mx-auto">
                <div className="space-y-4">
                    {PAST_SESSIONS.map((session) => (
                        <div
                            key={session.id}
                            className="bg-[#16181A] border border-[#232529] rounded-[8px] p-5 flex flex-col sm:flex-row sm:items-center gap-5 hover:bg-[#1A1C20] hover:border-[#2A2D32] transition-colors cursor-pointer group shadow-sm"
                        >

                            {/* Left: icon/agent indicator */}
                            <div className="relative shrink-0 hidden sm:block">
                                <img
                                    src={session.agent.avatar}
                                    alt={session.agent.name}
                                    className="w-10 h-10 rounded-full object-cover shadow-sm border border-[#232529]"
                                />
                                <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#1A1C20] border-2 border-[#16181A] flex items-center justify-center group-hover:border-[#1A1C20] transition-colors">
                                    <Terminal className="w-2.5 h-2.5 text-[#8A8F98]" />
                                </div>
                            </div>

                            {/* Center: Details */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-3 mb-1.5">
                                    <h2 className="text-[15px] font-medium text-[#F2F2F2] group-hover:text-[#5E6AD2] transition-colors truncate">
                                        {session.title}
                                    </h2>
                                    {session.status === 'interrupted' && (
                                        <span className="text-[10px] font-medium bg-[#D29922]/10 text-[#D29922] px-1.5 py-0.5 rounded-[4px] border border-[#D29922]/20">
                                            Interrupted
                                        </span>
                                    )}
                                </div>

                                <p className="text-[13px] text-[#8A8F98] line-clamp-1 mb-3 leading-relaxed">
                                    {session.summary}
                                </p>

                                <div className="flex flex-wrap items-center gap-y-2 gap-x-4 text-[12px] text-[#5E626B]">
                                    <span className="flex items-center gap-1.5" title="Date">
                                        <Calendar className="w-3.5 h-3.5 text-[#5E626B]" />
                                        {session.date}
                                    </span>
                                    <span className="flex items-center gap-1.5" title="Duration">
                                        <Clock className="w-3.5 h-3.5 text-[#5E626B]" />
                                        {session.duration}
                                    </span>
                                    <span className="flex items-center gap-1.5" title="Turns">
                                        <MessageSquare className="w-3.5 h-3.5 text-[#5E626B]" />
                                        {session.turns} turns
                                    </span>
                                    <span className="flex items-center gap-1.5 ml-auto text-[#8A8F98] font-medium">
                                        {session.agent.name}
                                    </span>
                                </div>
                            </div>

                            {/* Right: Actions */}
                            <div className="shrink-0 flex items-center gap-2 mt-4 sm:mt-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button className="bg-[#232529] hover:bg-[#2A2D32] text-[#D1D3D8] p-2 rounded-[6px] transition-colors border border-transparent hover:border-[#3A3F4A]" title="View Transcript">
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                                <button className="bg-[#232529] hover:bg-[#2A2D32] text-[#D1D3D8] p-2 rounded-[6px] transition-colors border border-transparent hover:border-[#3A3F4A]" title="Resume Session">
                                    <Play className="w-4 h-4 ml-0.5" />
                                </button>
                            </div>

                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
