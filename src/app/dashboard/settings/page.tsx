"use client";

import React, { useState } from 'react';
import {
    User,
    Briefcase,
    Palette,
    Cpu,
    Key,
    Bell,
    Shield,
    CreditCard
} from 'lucide-react';

const SETTINGS_CATEGORIES = [
    { id: 'general', label: 'General', icon: Briefcase },
    { id: 'account', label: 'Account', icon: User },
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'agents', label: 'Agents', icon: Cpu },
    { id: 'api-keys', label: 'API Keys', icon: Key },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'billing', label: 'Billing', icon: CreditCard },
];

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

                    {/* Placeholder for other tabs */}
                    {activeTab !== 'general' && (
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
    account: "Account",
    appearance: "Appearance",
    agents: "Agents",
    "api-keys": "API Keys",
    notifications: "Notifications",
    security: "Security",
    billing: "Billing"
};
