"use client";

import React, { useEffect, useState } from 'react';
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
import { createSupabaseBrowserClient } from '@/utils/supabase/client';

interface InboxItem {
    id: string;
    agent: string;
    type: 'commit' | 'error' | 'mention' | 'status' | 'log';
    task: string;
    title: string;
    description: string;
    time: string;
    icon: any;
    iconColor: string;
    unread: boolean;
    avatarUrl: string;
    rawTimestamp: Date;
}

interface InboxGroup {
    id: string;
    date: string;
    items: InboxItem[];
}

function getIconForType(type: InboxItem['type']) {
    switch (type) {
        case 'commit': return GitCommit;
        case 'error': return AlertCircle;
        case 'mention': return MessageSquare;
        case 'status': return Bot;
        default: return Bot;
    }
}

function getIconColorForType(type: InboxItem['type']) {
    switch (type) {
        case 'commit': return "text-emerald-400";
        case 'error': return "text-rose-400";
        case 'mention': return "text-blue-400";
        default: return "text-[#909090]";
    }
}

function formatGroupDate(date: Date): string {
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    if (isToday) return "Today";
    if (isYesterday) return "Yesterday";
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function InboxPage() {
    const [filter, setFilter] = useState('All');
    const [user, setUser] = useState<any>(null);
    const [checkingAuth, setCheckingAuth] = useState(true);
    const [showOnboarding, setShowOnboarding] = useState(false);
    const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
    const [hasAgentConnected, setHasAgentConnected] = useState(false);
    const [hasFirstSessionActivity, setHasFirstSessionActivity] = useState(false);
    const [inboxGroups, setInboxGroups] = useState<InboxGroup[]>([]);
    const [isLoadingFeed, setIsLoadingFeed] = useState(false);
    const [readIds, setReadIds] = useState<Set<string>>(new Set());

    // Load read IDs from localStorage on mount
    useEffect(() => {
        const saved = localStorage.getItem('orkestrate_read_ids');
        if (saved) {
            try {
                setReadIds(new Set(JSON.parse(saved)));
            } catch (e) {
                console.error("Failed to parse read IDs", e);
            }
        }
    }, []);

    // Save read IDs to localStorage when they change
    useEffect(() => {
        localStorage.setItem('orkestrate_read_ids', JSON.stringify(Array.from(readIds)));
    }, [readIds]);

    const markAllAsRead = () => {
        const allIds = inboxGroups.flatMap(g => g.items.map(i => i.id));
        setReadIds(prev => new Set([...Array.from(prev), ...allIds]));
    };

    const markAsRead = (id: string) => {
        setReadIds(prev => {
            const next = new Set(prev);
            next.add(id);
            return next;
        });
    };

    useEffect(() => {
        const supabase = createSupabaseBrowserClient();

        const run = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            setUser(session?.user ?? null);
            setCheckingAuth(false);
            const token = session?.access_token;
            if (!token) return;

            try {
                // 1. Get workspaces
                const roomsRes = await fetch("/api/workspaces", {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (!roomsRes.ok) return;
                const workspacesData = await roomsRes.json();
                const workspaces = Array.isArray(workspacesData?.workspaces) ? workspacesData.workspaces : (Array.isArray(workspacesData?.rooms) ? workspacesData.rooms : []);
                const resolvedWorkspaceId = workspaces.find((r: any) => r.isActive)?.id || workspaces[0]?.id;
                setActiveWorkspaceId(resolvedWorkspaceId || null);
                if (!resolvedWorkspaceId) {
                    setShowOnboarding(true);
                    return;
                }

                // 2. Get room content (agents metadata)
                const contentRes = await fetch(`/api/room-content?workspaceId=${encodeURIComponent(resolvedWorkspaceId)}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const agents = contentRes.ok ? (await contentRes.json()).agents || [] : [];
                const agentsMap = new Map(agents.map((a: any) => [a.id, a]));
                setHasAgentConnected(agents.length > 0);

                // 3. Static Placeholders (Cleaning out live feed)
                const mockItems: InboxItem[] = [
                    {
                        id: 'm1',
                        agent: 'Alpha',
                        type: 'commit',
                        task: 'O-101 JWT Middleware',
                        title: 'Committed 4 files to main',
                        description: 'Implemented basic JWT verification wrapper and added tests.',
                        time: '10:24 AM',
                        icon: GitCommit,
                        iconColor: 'text-emerald-400',
                        unread: true,
                        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alpha',
                        rawTimestamp: new Date()
                    },
                    {
                        id: 'm2',
                        agent: 'Charlie',
                        type: 'error',
                        task: 'O-102 DB Migrations',
                        title: 'Encountered a migration conflict',
                        description: 'Failed to apply 004_add_index.sql due to existing lock.',
                        time: '9:15 AM',
                        icon: AlertCircle,
                        iconColor: 'text-rose-400',
                        unread: true,
                        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Charlie',
                        rawTimestamp: new Date()
                    },
                    {
                        id: 'm3',
                        agent: 'System',
                        type: 'mention',
                        task: 'O-105 Landing Page',
                        title: 'Bravo mentioned you',
                        description: '@pracu I need approval to install the new framer-motion dependency.',
                        time: '8:42 AM',
                        icon: MessageSquare,
                        iconColor: 'text-blue-400',
                        unread: true,
                        avatarUrl: 'https://api.dicebear.com/7.x/shapes/svg?seed=System',
                        rawTimestamp: new Date()
                    },
                    {
                        id: 'm4',
                        agent: 'Alpha',
                        type: 'status',
                        task: 'O-101 JWT Middleware',
                        title: 'Moved task to In Progress',
                        description: 'Began reviewing the current authentication architecture.',
                        time: '4:30 PM',
                        icon: Bot,
                        iconColor: 'text-[#909090]',
                        unread: false,
                        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alpha',
                        rawTimestamp: new Date(Date.now() - 86400000) // Yesterday
                    }
                ];

                const groups: InboxGroup[] = [
                    {
                        id: 'today',
                        date: 'Today',
                        items: mockItems.filter(i => formatGroupDate(i.rawTimestamp) === 'Today')
                    },
                    {
                        id: 'yesterday',
                        date: 'Yesterday',
                        items: mockItems.filter(i => formatGroupDate(i.rawTimestamp) === 'Yesterday')
                    }
                ];

                setInboxGroups(groups);
                setHasFirstSessionActivity(true);
                setShowOnboarding(false);
            } catch (err) {
                console.error("Inbox fetch failed", err);
            } finally {
                setIsLoadingFeed(false);
            }
        };

        void run();
        const poll = setInterval(() => {
            void run();
        }, 10000);
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
        });
        return () => {
            clearInterval(poll);
            subscription.unsubscribe();
        };
    }, [filter, readIds.size]);

    if (checkingAuth) {
        return <div className="h-full w-full bg-[#111214] text-[#8A8F98] font-sans flex items-center justify-center">Loading...</div>;
    }

    if (!user) {
        return (
            <div className="h-full w-full bg-[#111214] text-[#EBEBEB] font-sans flex items-center justify-center">
                <div className="text-center">
                    <h1 className="text-[18px] font-semibold text-[#F2F2F2] mb-2">Sign in required</h1>
                    <p className="text-[13px] text-[#8A8F98] mb-4">Please sign in from the landing page to access your dashboard.</p>
                    <Link href="/" className="inline-flex items-center px-4 py-2 rounded-[6px] bg-[#F2F2F2] text-[#111214] text-[13px] font-semibold hover:bg-white">
                        Go to landing page
                    </Link>
                </div>
            </div>
        );
    }

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
                    <button
                        onClick={() => markAllAsRead()}
                        className="p-1.5 text-[#8A8F98] hover:text-[#F2F2F2] hover:bg-[#232529] rounded-[6px] transition-colors"
                        title="Mark all as read"
                    >
                        <Check className="w-4 h-4" />
                    </button>
                    <button className="p-1.5 text-[#8A8F98] hover:text-[#F2F2F2] hover:bg-[#232529] rounded-[6px] transition-colors" title="Filter options">
                        <Filter className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* List View */}
            <div className="flex-1 overflow-y-auto w-full max-w-5xl mx-auto py-8 px-8">
                {showOnboarding && !isLoadingFeed && (
                    <div className="mb-8 rounded-[10px] border border-[#232529] bg-[#16181A] p-5">
                        <h2 className="text-[15px] font-semibold text-[#F2F2F2] mb-2">Welcome to Orkestrate</h2>
                        <p className="text-[13px] text-[#8A8F98] mb-4">Your workspace is ready. Complete these steps to start collaborating:</p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <Link href="/dashboard/settings" className="rounded-[8px] border border-[#232529] bg-[#111214] p-3 hover:border-[#3A3F4A]">
                                <div className="text-[11px] text-[#5E626B] mb-1">Step 1</div>
                                <div className="text-[13px] text-[#D1D3D8]">Review workspace settings</div>
                            </Link>
                            <Link href="/docs#quickstart" className={`rounded-[8px] border p-3 ${hasAgentConnected ? "border-[#3FB950]/40 bg-[#3FB950]/10" : "border-[#232529] bg-[#111214] hover:border-[#3A3F4A]"}`}>
                                <div className="text-[11px] text-[#5E626B] mb-1">Step 2</div>
                                <div className="text-[13px] text-[#D1D3D8]">Connect your first agent {hasAgentConnected ? "✓" : ""}</div>
                            </Link>
                            <Link href="/dashboard/agent-chat" className={`rounded-[8px] border p-3 ${hasFirstSessionActivity ? "border-[#3FB950]/40 bg-[#3FB950]/10" : hasAgentConnected ? "border-[#232529] bg-[#111214] hover:border-[#3A3F4A]" : "border-[#232529]/60 bg-[#111214]/60 pointer-events-none opacity-60"}`}>
                                <div className="text-[11px] text-[#5E626B] mb-1">Step 3</div>
                                <div className="text-[13px] text-[#D1D3D8]">Start your first session {hasFirstSessionActivity ? "✓" : ""}</div>
                            </Link>
                        </div>
                        <div className="mt-4 text-[11px] text-[#5E626B]">
                            Workspace: <span className="text-[#8A8F98]">{activeWorkspaceId || "n/a"}</span> · Status refreshes every 10s
                        </div>
                    </div>
                )}
                <div className="space-y-8">
                    {inboxGroups.length === 0 && !isLoadingFeed && (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <div className="w-12 h-12 rounded-full bg-[#16181A] border border-[#232529] flex items-center justify-center mb-4">
                                <MessageSquare className="w-6 h-6 text-[#3A3F4A]" />
                            </div>
                            <h3 className="text-[15px] font-medium text-[#D1D3D8]">No activity yet</h3>
                            <p className="text-[13px] text-[#8A8F98] max-w-[280px] mt-1">
                                When your agents perform tasks or mention you, they will appear here.
                            </p>
                        </div>
                    )}

                    {isLoadingFeed && inboxGroups.length === 0 && (
                        <div className="flex items-center justify-center py-20">
                            <div className="text-[13px] text-[#8A8F98] animate-pulse">Syncing feed...</div>
                        </div>
                    )}

                    {inboxGroups.map((group) => (
                        <div key={group.id}>
                            <h2 className="text-[11px] font-semibold text-[#8A8F98] mb-2 uppercase tracking-wider px-2">
                                {group.date}
                            </h2>
                            <div className="flex flex-col">
                                {group.items.map((item) => (
                                    <div
                                        key={item.id}
                                        onClick={() => markAsRead(item.id)}
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
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            markAsRead(item.id);
                                                        }}
                                                        className="p-1 text-[#8A8F98] hover:text-[#F2F2F2] hover:bg-[#2A2D32] rounded-[4px] ml-1 transition-colors"
                                                    >
                                                        <Check className={`w-3.5 h-3.5 ${!item.unread ? 'text-emerald-400' : ''}`} />
                                                    </button>
                                                    <button
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="p-1 text-[#8A8F98] hover:text-[#F2F2F2] hover:bg-[#2A2D32] rounded-[4px] transition-colors"
                                                    >
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


