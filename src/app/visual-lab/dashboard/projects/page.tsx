"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import {
    Plus,
    Search,
    MoreHorizontal,
    Clock,
    CheckCircle2,
    Circle,
    CircleDot,
    BarChart3
} from 'lucide-react';

const PROJECTS = [
    {
        id: 'p1',
        name: 'Auth Refactor v2',
        status: 'In Progress',
        statusColor: 'text-[#5E6AD2]',
        progress: 65,
        targetDate: 'Oct 24',
        lead: { name: 'Alpha', initials: 'A', avatarUrl: "https://images.unsplash.com/photo-1531427186611-ecfd6d936c79?w=64&h=64&fit=crop&crop=faces&auto=format&q=80" },
        updatedAt: '2h ago',
        tasks: [
            { name: 'O-101 JWT Middleware', status: 'in_progress', agent: 'Alpha' },
            { name: 'O-102 DB Migrations', status: 'done', agent: 'Charlie' },
            { name: 'O-103 Redis Session Cache', status: 'todo', agent: 'Bravo' }
        ]
    },
    {
        id: 'p2',
        name: 'Landing Page Redesign',
        status: 'Planning',
        statusColor: 'text-[#D29922]',
        progress: 10,
        targetDate: 'Nov 5',
        lead: { name: 'Pracu', initials: 'P', avatarUrl: "https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=64&h=64&fit=crop&crop=faces&auto=format&q=80" },
        updatedAt: '1d ago',
        tasks: [
            { name: 'O-105 Setup Framer Motion', status: 'todo', agent: 'Delta' },
            { name: 'O-106 Hero Section Animations', status: 'todo', agent: 'Unassigned' }
        ]
    },
    {
        id: 'p3',
        name: 'Payment Gateway Integration',
        status: 'Completed',
        statusColor: 'text-[#3FB950]',
        progress: 100,
        targetDate: 'Sep 30',
        lead: { name: 'Charlie', initials: 'C', avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=64&h=64&fit=crop&crop=faces&auto=format&q=80" },
        updatedAt: '1w ago',
        tasks: [
            { name: 'O-092 Stripe Webhooks', status: 'done', agent: 'Charlie' },
            { name: 'O-093 Subscription Models', status: 'done', agent: 'Bravo' }
        ]
    }
];

export default function ProjectsPage() {
    const [searchQuery, setSearchQuery] = useState('');

    return (
        <div className="h-full w-full bg-[#111214] text-[#EBEBEB] font-sans flex flex-col">
            {/* Header */}
            <div className="px-8 py-5 border-b border-[#232529] flex items-center justify-between shrink-0 bg-[#111214]/80 backdrop-blur-md sticky top-0 z-10">
                <div className="flex items-center gap-4">
                    <h1 className="text-[15px] font-semibold tracking-tight text-[#F2F2F2]">Projects</h1>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8A8F98]" />
                        <input
                            type="text"
                            placeholder="Find project..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-[#1A1C20] border border-[#2A2D32] rounded-[6px] py-1.5 pl-8 pr-3 text-[13px] text-[#F2F2F2] placeholder:text-[#5E626B] focus:outline-none focus:border-[#444853] focus:bg-[#232529] w-48 transition-colors shadow-inner"
                        />
                    </div>
                    <button className="flex items-center gap-1.5 bg-[#F2F2F2] hover:bg-white text-[#111214] px-3 py-1.5 rounded-[6px] text-[13px] font-semibold transition-colors shadow-sm">
                        <Plus className="w-4 h-4" />
                        New Project
                    </button>
                </div>
            </div>

            {/* List View */}
            <div className="flex-1 overflow-y-auto w-full max-w-5xl mx-auto py-8 px-8">
                <div className="space-y-4">
                    {PROJECTS.map(project => (
                        <div key={project.id} className="bg-[#16181A] border border-[#232529] rounded-[10px] shadow-sm hover:border-[#33363D] transition-colors group flex flex-col overflow-hidden">

                            {/* Project Header Area */}
                            <div className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-3 mb-1.5">
                                        <BarChart3 className={`w-4 h-4 ${project.statusColor}`} />
                                        <h2 className="text-[15px] font-semibold text-[#F2F2F2] truncate tracking-tight hover:underline underline-offset-2 decoration-[#373737] cursor-pointer">{project.name}</h2>
                                        <span className={`px-2 py-0.5 rounded-[4px] text-[11px] font-medium border ${project.status === 'Completed' ? 'bg-[#3FB950]/10 text-[#3FB950] border-[#3FB950]/20' :
                                                project.status === 'Planning' ? 'bg-[#D29922]/10 text-[#D29922] border-[#D29922]/20' :
                                                    'bg-[#5E6AD2]/10 text-[#5E6AD2] border-[#5E6AD2]/20'
                                            }`}>
                                            {project.status}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-4 text-[13px] text-[#8A8F98]">
                                        <div className="flex items-center gap-1.5" title="Target Date">
                                            <Clock className="w-3.5 h-3.5 text-[#A1A1A1]" /> {project.targetDate}
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <span>Updated {project.updatedAt}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-6 shrink-0">
                                    {/* Progress */}
                                    <div className="flex flex-col gap-1.5 w-32">
                                        <div className="flex justify-between text-[11px] font-medium text-[#8A8F98]">
                                            <span>Progress</span>
                                            <span>{project.progress}%</span>
                                        </div>
                                        <div className="h-1.5 w-full bg-[#111214] rounded-full overflow-hidden border border-white/5 shadow-inner">
                                            <div
                                                className={`h-full rounded-full transition-all duration-500 ${project.progress === 100 ? 'bg-[#3FB950]' : 'bg-[#5E6AD2]'}`}
                                                style={{ width: `${project.progress}%` }}
                                            ></div>
                                        </div>
                                    </div>

                                    {/* Lead */}
                                    <div className="flex flex-col gap-1 items-end pl-5 border-l border-[#232529]">
                                        <div className="text-[11px] font-medium text-[#5E626B] uppercase tracking-wider">Lead</div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[13px] text-[#D1D3D8]">{project.lead.name}</span>
                                            <img
                                                src={project.lead.avatarUrl}
                                                alt={project.lead.name}
                                                className="w-6 h-6 rounded-full object-cover shadow-sm border border-white/5"
                                            />
                                        </div>
                                    </div>

                                    <button className="p-1.5 text-[#8A8F98] hover:text-[#F2F2F2] hover:bg-[#2A2D32] rounded-[6px] opacity-0 group-hover:opacity-100 transition-all">
                                        <MoreHorizontal className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Active Tasks List */}
                            <div className="bg-[#111214]/50 border-t border-[#232529] p-3 px-5">
                                <div className="text-[11px] font-semibold text-[#8A8F98] mb-2 uppercase tracking-wider px-1">Active Tasks</div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                    {project.tasks.map((task, i) => (
                                        <Link href={`/visual-lab/dashboard/agent-chat`} key={i} className="flex items-center justify-between p-2 rounded-[6px] hover:bg-[#1A1C20] border border-transparent hover:border-[#33363D] transition-all group/task">
                                            <div className="flex items-center gap-2.5 truncate">
                                                {task.status === 'done' ? (
                                                    <CheckCircle2 className="w-4 h-4 text-[#3FB950] shrink-0" />
                                                ) : task.status === 'in_progress' ? (
                                                    <CircleDot className="w-4 h-4 text-[#5E6AD2] shrink-0" />
                                                ) : (
                                                    <Circle className="w-4 h-4 text-[#8A8F98] shrink-0" />
                                                )}
                                                <span className="text-[13px] text-[#D1D3D8] truncate group-hover/task:text-[#F2F2F2] transition-colors">{task.name}</span>
                                            </div>
                                            <div className="text-[11px] text-[#8A8F98] bg-[#111214] px-1.5 py-0.5 rounded-[4px] border border-[#232529] shrink-0 ml-2 shadow-sm font-medium">
                                                {task.agent}
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            </div>

                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
