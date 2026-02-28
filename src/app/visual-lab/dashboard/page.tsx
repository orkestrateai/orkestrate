"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import {
    Filter,
    Check,
    MessageSquare,
    AlertCircle,
    GitCommit,
    Bot,
    MoreHorizontal
} from 'lucide-react';

const INBOX_ITEMS = [
    {
        id: 1,
        date: "Today",
        items: [
            {
                id: '101',
                agent: "Alpha",
                type: 'commit',
                task: 'O-101 JWT Middleware',
                title: "Committed 4 files to main",
                description: "Implemented basic JWT verification wrapper and added tests.",
                time: "10:24 AM",
                icon: GitCommit,
                iconColor: "text-emerald-400",
                unread: true,
                avatarUrl: "https://images.unsplash.com/photo-1531427186611-ecfd6d936c79?w=64&h=64&fit=crop&crop=faces&auto=format&q=80"
            },
            {
                id: '102',
                agent: "Charlie",
                type: 'error',
                task: 'O-102 DB Migrations',
                title: "Encountered a migration conflict",
                description: "Failed to apply 004_add_index.sql due to existing lock.",
                time: "9:15 AM",
                icon: AlertCircle,
                iconColor: "text-rose-400",
                unread: true,
                avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=64&h=64&fit=crop&crop=faces&auto=format&q=80"
            },
            {
                id: '103',
                agent: "System",
                type: 'mention',
                task: 'O-105 Landing Page',
                title: "Bravo mentioned you",
                description: "@pracu I need approval to install the new framer-motion dependency.",
                time: "8:42 AM",
                icon: MessageSquare,
                iconColor: "text-blue-400",
                unread: false,
                avatarUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=64&h=64&fit=crop&crop=entropy&auto=format&q=80"
            }
        ]
    },
    {
        id: 2,
        date: "Yesterday",
        items: [
            {
                id: '201',
                agent: "Alpha",
                type: 'status',
                task: 'O-101 JWT Middleware',
                title: "Moved task to In Progress",
                description: "Began reviewing the current authentication architecture.",
                time: "4:30 PM",
                icon: Bot,
                iconColor: "text-[#909090]",
                unread: false,
                avatarUrl: "https://images.unsplash.com/photo-1531427186611-ecfd6d936c79?w=64&h=64&fit=crop&crop=faces&auto=format&q=80"
            }
        ]
    }
];

export default function InboxPage() {
    const [filter, setFilter] = useState('All');

    return (
        <div className="h-full w-full bg-[#111214] text-[#EBEBEB] font-sans flex flex-col">
            {/* Header */}
            <div className="px-8 py-5 border-b border-[#232529] flex items-center justify-between shrink-0 bg-[#111214]/80 backdrop-blur-md sticky top-0 z-10">
                <div className="flex items-center gap-6">
                    <h1 className="text-[15px] font-semibold tracking-tight text-[#F2F2F2]">Inbox</h1>

                    <div className="flex items-center gap-1">
                        {['All', 'Unread', 'Mentions', 'Errors'].map(f => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-2.5 py-1 text-[13px] rounded-[6px] transition-colors font-medium ${filter === f
                                    ? 'bg-[#232529] text-[#F2F2F2]'
                                    : 'text-[#8A8F98] hover:text-[#D1D3D8] hover:bg-white/[0.04]'
                                    }`}
                            >
                                {f}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex items-center gap-1">
                    <button className="p-1.5 text-[#8A8F98] hover:text-[#F2F2F2] hover:bg-[#232529] rounded-[6px] transition-colors" title="Mark all as read">
                        <Check className="w-4 h-4" />
                    </button>
                    <button className="p-1.5 text-[#8A8F98] hover:text-[#F2F2F2] hover:bg-[#232529] rounded-[6px] transition-colors" title="Filter options">
                        <Filter className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* List View */}
            <div className="flex-1 overflow-y-auto w-full max-w-5xl mx-auto py-8 px-8">
                <div className="space-y-8">
                    {INBOX_ITEMS.map((group) => (
                        <div key={group.date}>
                            <h2 className="text-[11px] font-semibold text-[#8A8F98] mb-2 uppercase tracking-wider px-2">
                                {group.date}
                            </h2>
                            <div className="flex flex-col">
                                {group.items.map((item, i) => (
                                    <div
                                        key={item.id}
                                        className={`flex items-start gap-4 py-3.5 px-3 rounded-[8px] hover:bg-[#1A1C20] cursor-pointer transition-colors group relative`}
                                    >
                                        {/* Unread dot */}
                                        {item.unread && (
                                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-[#5E6AD2]"></div>
                                        )}

                                        {/* Avatar / Icon */}
                                        <div className="relative shrink-0 mt-0.5 ml-1">
                                            <img
                                                src={item.avatarUrl}
                                                alt={item.agent}
                                                className="w-8 h-8 rounded-full object-cover shadow-inner border border-white/5"
                                            />
                                            <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#111214] border-2 border-[#111214] group-hover:bg-[#1A1C20] group-hover:border-[#1A1C20] flex items-center justify-center transition-colors">
                                                <item.icon className={`w-2 h-2 ${item.iconColor}`} />
                                            </div>
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                                            <div className="flex items-baseline justify-between gap-3 mb-0.5">
                                                <div className="flex items-center gap-1.5 truncate text-[13px]">
                                                    <span className={`font-semibold ${item.unread ? 'text-[#F2F2F2]' : 'text-[#D1D3D8]'}`}>
                                                        {item.agent}
                                                    </span>
                                                    <span className="text-[#8A8F98]">·</span>
                                                    <span className={`truncate ${item.unread ? 'text-[#EBEBEB] font-medium' : 'text-[#A1A1A1]'}`}>
                                                        {item.title}
                                                    </span>
                                                </div>
                                                <span className="text-[12px] text-[#8A8F98] shrink-0 font-medium">
                                                    {item.time}
                                                </span>
                                            </div>

                                            <div className="flex items-center justify-between gap-4">
                                                <p className="text-[13px] text-[#8A8F98] truncate leading-relaxed">
                                                    {item.description}
                                                </p>

                                                {/* Actions & Badges (Visible on Hover) */}
                                                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2 shrink-0">
                                                    <div className="text-[11px] font-medium text-[#8A8F98] bg-[#232529] border border-[#33363D] px-2 py-0.5 rounded-[4px] shadow-sm">
                                                        {item.task}
                                                    </div>
                                                    <button className="p-1 text-[#8A8F98] hover:text-[#F2F2F2] hover:bg-[#2A2D32] rounded-[4px] ml-1 transition-colors">
                                                        <Check className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button className="p-1 text-[#8A8F98] hover:text-[#F2F2F2] hover:bg-[#2A2D32] rounded-[4px] transition-colors">
                                                        <MoreHorizontal className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
