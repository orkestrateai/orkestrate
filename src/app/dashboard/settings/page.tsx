"use client";

import React, { useState, useEffect } from 'react';
import {
    User,
    Briefcase,
    Palette,
    Cpu,
    Key,
    Bell,
    Shield,
    CreditCard,
    GitBranch,
    CheckCircle,
    AlertCircle
} from 'lucide-react';
import useSWR from 'swr';
import { createSupabaseBrowserClient } from '@/utils/supabase/client';

const SETTINGS_CATEGORIES = [
    { id: 'general', label: 'General', icon: Briefcase },
    { id: 'git', label: 'Git', icon: GitBranch },
    { id: 'account', label: 'Account', icon: User },
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'agents', label: 'Agents', icon: Cpu },
    { id: 'api-keys', label: 'API Keys', icon: Key },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'billing', label: 'Billing', icon: CreditCard },
];

const settingsFetcher = (url: string) => {
    const supabase = createSupabaseBrowserClient();
    return supabase.auth.getSession().then(({ data: { session } }) => {
        return fetch(url, {
            headers: { Authorization: `Bearer ${session?.access_token}` },
        }).then((res) => res.json());
    });
};

export default function SettingsView() {
    const [activeTab, setActiveTab] = useState('general');

    return (
        <div className="h-full w-full bg-[#111214] text-[#EBEBEB] font-sans flex flex-col items-center">

            <div className="w-full max-w-5xl h-full flex pt-12">

                {/* Left navigation sidebar */}
                <div className="w-64 pr-8 shrink-0">
                    <h1 className="text-[20px] font-semibold tracking-tight text-[#F2F2F2] mb-8 pl-2">Settings</h1>

                    <nav className="space-y-1">
                        {SETTINGS_CATEGORIES.map((category) => {
                            const isActive = activeTab === category.id;
                            return (
                                <button
                                    key={category.id}
                                    onClick={() => setActiveTab(category.id)}
                                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-[6px] text-[13px] font-medium transition-colors ${isActive
                                            ? 'bg-[#1A1C20] text-[#EBEBEB] border border-[#232529] shadow-inner'
                                            : 'text-[#8A8F98] hover:bg-[#16181A] hover:text-[#D1D3D8] border border-transparent'
                                        }`}
                                >
                                    <category.icon className={`w-4 h-4 ${isActive ? 'text-[#EBEBEB]' : 'text-[#5E626B]'}`} />
                                    {category.label}
                                </button>
                            );
                        })}
                    </nav>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 overflow-y-auto pb-24">
                    {/* General Settings Content */}
                    {activeTab === 'general' && (
                        <div className="max-w-xl space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div>
                                <h2 className="text-[18px] font-medium text-[#F2F2F2] mb-1">Workspace settings</h2>
                                <p className="text-[13px] text-[#8A8F98] mb-6">Manage your workspace details and preferences.</p>

                                <div className="space-y-5">
                                    <div className="flex flex-col gap-2">
                                        <label className="text-[13px] font-medium text-[#D1D3D8]">Workspace Name</label>
                                        <input
                                            type="text"
                                            defaultValue="Mirai Kite Studio's Space"
                                            className="bg-[#16181A] border border-[#232529] rounded-[6px] py-2 px-3 text-[13px] text-[#F2F2F2] focus:outline-none focus:border-[#444853] focus:bg-[#1A1C20] transition-colors"
                                        />
                                    </div>

                                    <div className="flex flex-col gap-2">
                                        <label className="text-[13px] font-medium text-[#D1D3D8]">Workspace URL</label>
                                        <div className="flex items-center">
                                            <span className="bg-[#16181A] border border-r-0 border-[#232529] rounded-l-[6px] py-2 px-3 text-[13px] text-[#5E626B]">
                                                orkestrate.app/
                                            </span>
                                            <input
                                                type="text"
                                                defaultValue="miraikite"
                                                className="flex-1 bg-[#16181A] border border-[#232529] rounded-r-[6px] py-2 px-3 text-[13px] text-[#F2F2F2] focus:outline-none focus:border-[#444853] focus:bg-[#1A1C20] transition-colors"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="h-[1px] w-full bg-[#16181A] border-t border-[#232529]"></div>

                            <div>
                                <h3 className="text-[14px] font-medium text-[#F2F2F2] mb-4">Workspace Logo</h3>
                                <div className="flex items-start gap-6">
                                    <div className="w-16 h-16 rounded-[12px] bg-[#16181A] border border-[#232529] flex items-center justify-center text-[20px] font-medium text-[#8A8F98] shadow-sm">
                                        M
                                    </div>
                                    <div className="flex flex-col gap-3">
                                        <div className="flex gap-2">
                                            <button className="bg-[#EBEBEB] text-[#111214] hover:bg-white text-[13px] font-medium px-4 py-1.5 rounded-[6px] transition-colors">
                                                Upload image
                                            </button>
                                            <button className="bg-transparent border border-[#232529] text-[#8A8F98] hover:text-[#D1D3D8] hover:bg-[#16181A] text-[13px] font-medium px-4 py-1.5 rounded-[6px] transition-colors">
                                                Remove
                                            </button>
                                        </div>
                                        <p className="text-[12px] text-[#5E626B]">Pick an image up to 2MB. Valid formats are JPG, PNG, and GIF.</p>
                                    </div>
                                </div>
                            </div>

                            <div className="h-[1px] w-full bg-[#16181A] border-t border-[#232529]"></div>

                            <div>
                                <h3 className="text-[14px] font-medium text-[#F2F2F2] mb-1">Delete Workspace</h3>
                                <p className="text-[13px] text-[#8A8F98] mb-4 text-balance">
                                    Permanently remove your workspace and all of its contents from the Orkestrate platform. This action is not reversible.
                                </p>
                                <button className="bg-[#2A1515] hover:bg-[#3D1A1A] text-[#FF5B5B] border border-[#4D1F1F] text-[13px] font-medium px-4 py-1.5 rounded-[6px] transition-colors">
                                    Delete Workspace...
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Git Settings Content */}
                    {activeTab === 'git' && (
                        <GitSettingsTab />
                    )}

                    {/* Placeholder for other tabs */}
                    {activeTab !== 'general' && activeTab !== 'git' && (
                        <div className="max-w-xl animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <h2 className="text-[18px] font-medium text-[#F2F2F2] mb-1 capitalize">{activeTab} settings</h2>
                            <p className="text-[13px] text-[#8A8F98] mb-6">Manage your {activeTab} preferences.</p>

                            <div className="p-8 border border-[#232529] border-dashed rounded-[8px] bg-[#16181A]/50 flex flex-col items-center justify-center text-[#5E626B]">
                                <p className="text-[13px]">Configuration options for {categoryLabels[activeTab]} will appear here.</p>
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}

const categoryLabels: Record<string, string> = {
    git: "Git",
    account: "Account",
    appearance: "Appearance",
    agents: "Agents",
    "api-keys": "API Keys",
    notifications: "Notifications",
    security: "Security",
    billing: "Billing"
};

function GitSettingsTab() {
    const [repoUrl, setRepoUrl] = useState('');
    const [defaultBranch, setDefaultBranch] = useState('main');
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

    const { data: wsData } = useSWR("/api/workspaces", settingsFetcher);
    const rooms = Array.isArray(wsData?.rooms) ? wsData.rooms : [];
    const activeRoom = rooms.find((r: any) => r.isActive) || rooms[0];

    useEffect(() => {
        if (activeRoom?.repoUrl) {
            setRepoUrl(activeRoom.repoUrl);
        }
        if (activeRoom?.defaultBranch) {
            setDefaultBranch(activeRoom.defaultBranch);
        }
    }, [activeRoom]);

    const handleSave = async () => {
        if (!activeRoom?.id) return;
        
        setIsSaving(true);
        setSaveStatus('idle');

        const supabase = createSupabaseBrowserClient();
        const { data: { session } } = await supabase.auth.getSession();

        try {
            const res = await fetch(`/api/workspaces`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session?.access_token}`,
                },
                body: JSON.stringify({
                    action: 'bind-repo',
                    workspaceId: activeRoom.id,
                    repoUrl: repoUrl.trim() || null,
                }),
            });

            if (res.ok) {
                setSaveStatus('success');
                setTimeout(() => setSaveStatus('idle'), 3000);
            } else {
                setSaveStatus('error');
            }
        } catch {
            setSaveStatus('error');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="max-w-xl space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div>
                <h2 className="text-[18px] font-medium text-[#F2F2F2] mb-1">Git Repository Binding</h2>
                <p className="text-[13px] text-[#8A8F98] mb-6">
                    Bind this workspace to a Git repository for Git-Rooted Coordination. Agents must be in this repository to join.
                </p>

                <div className="space-y-5">
                    <div className="flex flex-col gap-2">
                        <label className="text-[13px] font-medium text-[#D1D3D8]">Repository URL</label>
                        <input
                            type="text"
                            value={repoUrl}
                            onChange={(e) => setRepoUrl(e.target.value)}
                            placeholder="https://github.com/org/repo"
                            className="bg-[#16181A] border border-[#232529] rounded-[6px] py-2 px-3 text-[13px] text-[#F2F2F2] placeholder:text-[#5E626B] focus:outline-none focus:border-[#444853] focus:bg-[#1A1C20] transition-colors font-mono"
                        />
                        <p className="text-[11px] text-[#5E626B]">
                            Enter the HTTPS URL of your GitHub/GitLab/Bitbucket repository
                        </p>
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-[13px] font-medium text-[#D1D3D8]">Default Branch</label>
                        <input
                            type="text"
                            value={defaultBranch}
                            onChange={(e) => setDefaultBranch(e.target.value)}
                            placeholder="main"
                            className="bg-[#16181A] border border-[#232529] rounded-[6px] py-2 px-3 text-[13px] text-[#F2F2F2] placeholder:text-[#5E626B] focus:outline-none focus:border-[#444853] focus:bg-[#1A1C20] transition-colors w-40"
                        />
                    </div>
                </div>

                <div className="mt-6 flex items-center gap-3">
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="bg-[#5E6AD2] hover:bg-[#4E5AC2] disabled:opacity-50 text-white px-4 py-2 rounded-[6px] text-[13px] font-medium transition-colors flex items-center gap-2"
                    >
                        {isSaving ? 'Saving...' : 'Save Changes'}
                        {saveStatus === 'success' && <CheckCircle className="w-4 h-4 text-emerald-300" />}
                    </button>
                    {saveStatus === 'error' && (
                        <span className="text-[13px] text-rose-400 flex items-center gap-1">
                            <AlertCircle className="w-4 h-4" />
                            Failed to save
                        </span>
                    )}
                </div>
            </div>

            <div className="h-[1px] w-full bg-[#16181A] border-t border-[#232529]"></div>

            <div>
                <h3 className="text-[14px] font-medium text-[#F2F2F2] mb-4">How Git-Rooted Coordination Works</h3>
                <div className="space-y-4 text-[13px] text-[#8A8F98]">
                    <div className="flex gap-3">
                        <div className="w-6 h-6 rounded-full bg-[#5E6AD2]/20 text-[#5E6AD2] flex items-center justify-center shrink-0 font-medium text-[12px]">1</div>
                        <div>
                            <span className="text-[#D1D3D8] font-medium">Join Guard</span>
                            <p className="mt-1">Agents must prove they are in the correct repository before joining this workspace.</p>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <div className="w-6 h-6 rounded-full bg-[#5E6AD2]/20 text-[#5E6AD2] flex items-center justify-center shrink-0 font-medium text-[12px]">2</div>
                        <div>
                            <span className="text-[#D1D3D8] font-medium">Branch Awareness</span>
                            <p className="mt-1">The dashboard shows which branch each agent is on, preventing cross-branch conflicts.</p>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <div className="w-6 h-6 rounded-full bg-[#5E6AD2]/20 text-[#5E6AD2] flex items-center justify-center shrink-0 font-medium text-[12px]">3</div>
                        <div>
                            <span className="text-[#D1D3D8] font-medium">Sync Status</span>
                            <p className="mt-1">Agents are warned if they are behind the remote or have uncommitted changes.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
