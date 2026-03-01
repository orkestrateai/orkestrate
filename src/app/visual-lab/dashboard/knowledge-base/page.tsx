"use client";

import React, { useState } from 'react';
import {
    Search,
    MoreHorizontal,
    FileText,
    ChevronRight,
    ChevronDown,
    Plus,
    Clock,
    History,
    MessageSquare,
    Folder
} from 'lucide-react';

const DOCUMENT_TREE = [
    {
        id: 'docs',
        name: 'Architecture',
        isOpen: true,
        children: [
            { id: 'd1', name: 'Core Engine Design', active: false },
            { id: 'd2', name: 'Agent Protocol', active: true },
            { id: 'd3', name: 'Context Limits', active: false },
        ]
    },
    {
        id: 'rules',
        name: 'Project Rules',
        isOpen: true,
        children: [
            { id: 'r1', name: 'Frontend Style Guide', active: false },
            { id: 'r2', name: 'Database Migrations', active: false }
        ]
    }
];

export default function KnowledgeBasePage() {
    return (
        <div className="h-full w-full bg-[#111214] text-[#EBEBEB] font-sans flex overflow-hidden">

            {/* Left Pane: Document Tree */}
            <div className="w-[280px] bg-[#111214] border-r border-[#232529] flex flex-col shrink-0">
                <div className="px-5 py-5 flex items-center justify-between shrink-0">
                    <h2 className="text-[15px] font-semibold text-[#F2F2F2]">Knowledge Base</h2>
                    <button className="text-[#8A8F98] hover:text-[#F2F2F2] hover:bg-[#232529] transition-colors p-1.5 rounded-[6px]">
                        <Plus className="w-4 h-4" />
                    </button>
                </div>

                <div className="px-3 pb-3">
                    <div className="relative mb-3">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8A8F98]" />
                        <input
                            type="text"
                            placeholder="Search docs..."
                            className="w-full bg-[#1A1C20] border border-[#2A2D32] rounded-[6px] py-1.5 pl-8 pr-3 text-[13px] text-[#F2F2F2] placeholder:text-[#5E626B] focus:outline-none focus:border-[#444853] focus:bg-[#232529] transition-colors shadow-inner"
                        />
                    </div>

                    <div className="space-y-1">
                        {DOCUMENT_TREE.map(folder => (
                            <div key={folder.id}>
                                <button className="flex items-center gap-1.5 w-full text-left px-2 py-1.5 text-[13px] font-medium text-[#8A8F98] hover:text-[#D1D3D8] transition-colors group">
                                    {folder.isOpen ? (
                                        <ChevronDown className="w-3.5 h-3.5 text-[#5E626B] group-hover:text-[#8A8F98]" />
                                    ) : (
                                        <ChevronRight className="w-3.5 h-3.5 text-[#5E626B] group-hover:text-[#8A8F98]" />
                                    )}
                                    <span className="flex items-center gap-1.5">
                                        <Folder className="w-3.5 h-3.5 text-[#5E626B] group-hover:text-[#8A8F98]" />
                                        {folder.name}
                                    </span>
                                </button>

                                {folder.isOpen && (
                                    <div className="pl-6 space-y-0.5 mt-0.5">
                                        {folder.children.map(doc => (
                                            <button
                                                key={doc.id}
                                                className={`flex items-center gap-2 w-full text-left px-2 py-1.5 text-[13px] rounded-[6px] transition-colors ${doc.active
                                                    ? 'bg-[#1A1C20] text-[#F2F2F2] font-medium shadow-sm'
                                                    : 'text-[#8A8F98] hover:bg-white/[0.04] hover:text-[#D1D3D8]'
                                                    }`}
                                            >
                                                <FileText className={`w-3.5 h-3.5 ${doc.active ? 'text-[#D1D3D8]' : 'text-[#5E626B]'}`} />
                                                <span className="truncate">{doc.name}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Right Pane: Document Editor */}
            <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#16181A]">

                {/* Editor Header */}
                <div className="px-8 py-5 flex items-center justify-between shrink-0 border-b border-[#232529]">
                    <div className="text-[13px] text-[#8A8F98] flex items-center gap-2 font-medium">
                        <span className="hover:text-[#D1D3D8] transition-colors cursor-pointer text-[#8A8F98]">Architecture</span>
                        <span className="text-[#5E626B]">/</span>
                        <span className="text-[#F2F2F2]">Agent Protocol</span>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex items-center -space-x-1.5 mr-2">
                            {/* Read indicators */}
                            <img
                                src="https://images.unsplash.com/photo-1531427186611-ecfd6d936c79?w=32&h=32&fit=crop&crop=faces&auto=format&q=80"
                                alt="Alpha"
                                className="w-6 h-6 rounded-full object-cover border-2 border-[#16181A] z-20 shadow-sm"
                                title="Read by Alpha 5m ago"
                            />
                            <img
                                src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=32&h=32&fit=crop&crop=entropy&auto=format&q=80"
                                alt="Bravo"
                                className="w-6 h-6 rounded-full object-cover border-2 border-[#16181A] z-10 shadow-sm"
                                title="Read by Bravo 2h ago"
                            />
                        </div>

                        <div className="flex items-center gap-2 text-[#8A8F98]">
                            <button className="flex items-center gap-1.5 hover:text-[#F2F2F2] transition-colors text-[13px] hover:bg-[#232529] px-2 py-1.5 rounded-[6px]">
                                <Clock className="w-4 h-4 text-[#5E626B]" />
                                <span>Edited 2h ago</span>
                            </button>
                            <button className="hover:text-[#F2F2F2] transition-colors p-1.5 hover:bg-[#232529] rounded-[6px]">
                                <History className="w-4 h-4" />
                            </button>
                            <button className="hover:text-[#F2F2F2] transition-colors p-1.5 hover:bg-[#232529] rounded-[6px]">
                                <MoreHorizontal className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Editor Content Area */}
                <div className="flex-1 overflow-y-auto px-12 py-12">
                    <div className="max-w-3xl mx-auto">
                        <h1 className="text-3xl font-bold text-[#F2F2F2] tracking-tight mb-8">Agent Protocol</h1>

                        <div className="prose prose-invert prose-zinc max-w-none">
                            <p className="text-[15px] leading-relaxed text-[#D1D3D8]">
                                This document outlines the standard protocol by which Orkestrate agents communicate, lock resources, and broadcast their state.
                            </p>

                            <h2 className="text-[18px] font-semibold text-[#F2F2F2] mt-10 mb-4 border-b border-[#232529] pb-2">1. Communication Envelope</h2>
                            <p className="text-[15px] leading-relaxed text-[#D1D3D8]">
                                All agent outputs to the platform must be wrapped in the standard <code className="bg-[#232529] px-1.5 py-0.5 rounded-[4px] text-[13px] text-[#A1A1A1] border border-[#2A2D32]">sendLog()</code> format. The <code className="bg-[#232529] px-1.5 py-0.5 rounded-[4px] text-[13px] text-[#A1A1A1] border border-[#2A2D32]">type</code> field is strictly typed.
                            </p>

                            <div className="bg-[#111214] border border-[#232529] rounded-[8px] p-5 my-6 font-mono text-[13px] text-[#8A8F98] shadow-sm leading-relaxed">
                                <div className="text-[#5E6AD2] mb-1">{`{`}</div>
                                <div className="pl-6 border-l border-[#232529] ml-2 my-1">
                                    <span className="text-[#3FB950]">"event"</span>: <span className="text-[#D29922]">"agent_log"</span>,<br />
                                    <span className="text-[#3FB950]">"payload"</span>: {`{`}<br />
                                    <div className="pl-6 border-l border-[#232529] ml-2 my-1">
                                        <span className="text-[#3FB950]">"timestamp"</span>: <span className="text-[#D29922]">"2026-02-27T12:00:00Z"</span>,<br />
                                        <span className="text-[#3FB950]">"type"</span>: <span className="text-[#D29922]">"function_call"</span>,<br />
                                        <span className="text-[#3FB950]">"data"</span>: {`{ ... }`}<br />
                                    </div>
                                    {`}`}
                                </div>
                                <div className="text-[#5E6AD2] mt-1">{`}`}</div>
                            </div>

                            <h2 className="text-[18px] font-semibold text-[#F2F2F2] mt-10 mb-4 border-b border-[#232529] pb-2">2. File Locking</h2>
                            <p className="text-[15px] leading-relaxed text-[#D1D3D8]">
                                Before modifying any file, an agent must invoke the <code className="bg-[#232529] px-1.5 py-0.5 rounded-[4px] text-[13px] text-[#A1A1A1] border border-[#2A2D32]">acquire_lock</code> tool. If the lock is held by another agent, the tool will return an error and the agent must queue the task or route around it.
                            </p>

                            <div className="flex items-start gap-3 p-4 my-6 bg-[#D29922]/10 border border-[#D29922]/20 rounded-[8px]">
                                <div className="text-[#D29922] shrink-0 mt-0.5">⚠️</div>
                                <div className="text-[14px] text-[#D29922]/90 leading-relaxed">
                                    <strong className="text-[#D29922]">Important:</strong> Agents must never retry a file lock more than 3 times without waiting explicitly via the <code className="bg-[#D29922]/20 px-1.5 py-0.5 rounded-[4px] text-[13px] text-[#D29922] border border-[#D29922]/30">sleep</code> tool.
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
