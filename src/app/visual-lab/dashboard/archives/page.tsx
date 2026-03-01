"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import {
    Search,
    Archive,
    CheckCircle2,
    CalendarDays,
    ArrowUpRight
} from 'lucide-react';

const ARCHIVED_TASKS = [
    {
        id: 'a1',
        title: 'O-092 Stripe Webhooks',
        resolutionDate: 'Oct 15, 2026',
        project: 'Payment Gateway Integration',
        lead: { name: 'Charlie', avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=32&h=32&fit=crop&crop=faces&auto=format&q=80' },
        summary: 'Implemented and tested the raw body webhook signature verification for checkout.session.completed events.'
    },
    {
        id: 'a2',
        title: 'O-093 Subscription Models',
        resolutionDate: 'Oct 12, 2026',
        project: 'Payment Gateway Integration',
        lead: { name: 'Bravo', avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=32&h=32&fit=crop&crop=entropy&auto=format&q=80' },
        summary: 'Added Prisma schemas for Tier, Subscription, and Customer objects. Linked to Stripe customer IDs.'
    },
    {
        id: 'a3',
        title: 'O-084 Dark Mode Toggle',
        resolutionDate: 'Sep 28, 2026',
        project: 'Frontend Refine',
        lead: { name: 'Alpha', avatar: 'https://images.unsplash.com/photo-1531427186611-ecfd6d936c79?w=32&h=32&fit=crop&crop=faces&auto=format&q=80' },
        summary: 'Replaced tailwind arbitrary values with CSS variables for semantic dark/light mode switching.'
    }
];

export default function ArchivedTasksPage() {
    const [searchQuery, setSearchQuery] = useState('');

    return (
        <div className="h-full w-full bg-[#111214] text-[#EBEBEB] font-sans flex flex-col">
            {/* Header */}
            <div className="px-8 py-5 border-b border-[#232529] flex items-center justify-between shrink-0 bg-[#16181A]">
                <div className="flex items-center gap-3 text-[#EBEBEB]">
                    <Archive className="w-5 h-5 text-[#8A8F98]" />
                    <h1 className="text-[16px] font-semibold tracking-tight text-[#F2F2F2]">Archived Tasks</h1>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8A8F98]" />
                        <input
                            type="text"
                            placeholder="Search archives..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-[#1A1C20] border border-[#2A2D32] rounded-[6px] py-1.5 pl-8 pr-3 text-[13px] text-[#F2F2F2] placeholder:text-[#5E626B] focus:outline-none focus:border-[#444853] focus:bg-[#232529] w-64 transition-colors shadow-inner"
                        />
                    </div>
                </div>
            </div>

            {/* List View */}
            <div className="flex-1 overflow-y-auto p-8 max-w-4xl w-full mx-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {ARCHIVED_TASKS.map((task) => (
                        <div
                            key={task.id}
                            className="bg-[#16181A] border border-[#232529] rounded-[8px] p-5 hover:border-[#3A3F4A] hover:bg-[#1A1C20] transition-colors cursor-pointer group flex flex-col justify-between shadow-sm"
                        >
                            <div>
                                <div className="flex items-start justify-between mb-3">
                                    <h2 className="text-[15px] font-medium text-[#F2F2F2] group-hover:text-[#5E6AD2] transition-colors line-clamp-1 pr-4">
                                        {task.title}
                                    </h2>
                                    <CheckCircle2 className="w-4 h-4 text-[#3FB950] shrink-0 mt-0.5" />
                                </div>

                                <p className="text-[13px] text-[#8A8F98] leading-relaxed mb-4 line-clamp-2 min-h-[40px]">
                                    {task.summary}
                                </p>
                            </div>

                            <div className="flex items-center justify-between pt-4 border-t border-[#232529] mt-auto">
                                <div className="flex items-center gap-2.5">
                                    <img
                                        src={task.lead.avatar}
                                        alt={task.lead.name}
                                        className="w-5 h-5 rounded-full object-cover border border-[#232529] shadow-sm"
                                    />
                                    <span className="text-[12px] font-medium text-[#8A8F98]">
                                        {task.project}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1.5 text-[11px] font-medium text-[#5E626B]">
                                    <CalendarDays className="w-3.5 h-3.5 text-[#5E626B]" />
                                    <span>{task.resolutionDate}</span>
                                    <ArrowUpRight className="w-3.5 h-3.5 ml-1 opacity-0 group-hover:opacity-100 transition-opacity text-[#5E626B]" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
