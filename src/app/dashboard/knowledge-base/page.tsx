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

import useSWR from 'swr';
import { createSupabaseBrowserClient } from '@/utils/supabase/client';
import ReactMarkdown from 'react-markdown';

const fetcher = (url: string) => {
    const supabase = createSupabaseBrowserClient();
    return supabase.auth.getSession().then(({ data: { session } }) => {
        return fetch(url, {
            headers: { Authorization: `Bearer ${session?.access_token}` },
        }).then((res) => res.json());
    });
};

type DocNode = {
    id: string;
    workspaceId: string;
    title: string;
    description: string;
    content: string;
    parentId: string | null;
    isFolder: boolean;
    updatedAt: string;
    children?: DocNode[];
    isOpen?: boolean;
};

export default function KnowledgeBasePage() {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState('');
    const [editTitle, setEditTitle] = useState('');
    const [editDescription, setEditDescription] = useState('');
    const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(new Set());

    const { data: wsData } = useSWR("/api/workspaces", fetcher);
    const rooms = Array.isArray(wsData?.rooms) ? wsData.rooms : [];
    const activeRoomId = rooms.find((r: any) => r.isActive)?.id || rooms[0]?.id || null;

    const { data: knowledgeData, mutate: mutateKnowledge } = useSWR(activeRoomId ? `/api/knowledge?workspaceId=${activeRoomId}` : null, fetcher);
    const rawDocs: DocNode[] = Array.isArray(knowledgeData?.docs) ? knowledgeData.docs : [];

    // Filter by search
    const searchedDocs = rawDocs.filter(d =>
        d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (d.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.content.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Build tree
    const rootNodes: DocNode[] = [];
    const nodeMap = new Map<string, DocNode>();

    rawDocs.forEach(doc => nodeMap.set(doc.id, { ...doc, children: [] }));
    rawDocs.forEach(doc => {
        const node = nodeMap.get(doc.id)!;
        if (doc.parentId && nodeMap.has(doc.parentId)) {
            nodeMap.get(doc.parentId)!.children!.push(node);
        } else {
            rootNodes.push(node);
        }
    });

    const selectedDoc = rawDocs.find(d => d.id === selectedDocId);

    const handleToggleFolder = (id: string) => {
        const next = new Set(expandedFolderIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setExpandedFolderIds(next);
    };

    const handleSelectDoc = (doc: DocNode) => {
        if (doc.isFolder) {
            handleToggleFolder(doc.id);
        } else {
            setSelectedDocId(doc.id);
            setEditContent(doc.content);
            setEditTitle(doc.title);
            setEditDescription(doc.description || '');
            setIsEditing(false);
        }
    };

    const handleSave = async () => {
        if (!selectedDoc || !activeRoomId) return;

        const supabase = createSupabaseBrowserClient();
        const { data: { session } } = await supabase.auth.getSession();

        const res = await fetch("/api/knowledge", {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session?.access_token}`,
            },
            body: JSON.stringify({
                id: selectedDoc.id,
                workspaceId: activeRoomId,
                title: editTitle,
                description: editDescription,
                content: editContent,
            }),
        });

        if (res.ok) {
            setIsEditing(false);
            void mutateKnowledge();
        }
    };

    const handleCreate = async (isFolder: boolean) => {
        if (!activeRoomId) return;

        const title = isFolder ? "New Folder" : "Untitled Document";
        const supabase = createSupabaseBrowserClient();
        const { data: { session } } = await supabase.auth.getSession();

        const res = await fetch("/api/knowledge", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session?.access_token}`,
            },
            body: JSON.stringify({
                workspaceId: activeRoomId,
                title,
                description: "",
                isFolder,
                content: "",
            }),
        });

        if (res.ok) {
            const data = await res.json();
            void mutateKnowledge();
            if (!isFolder) {
                setSelectedDocId(data.doc.id);
                setEditContent("");
                setEditTitle(title);
                setEditDescription("");
                setIsEditing(true);
            }
        }
    };

    const renderTree = (nodes: DocNode[]) => {
        return nodes.map(node => (
            <div key={node.id}>
                <button
                    onClick={() => handleSelectDoc(node)}
                    className={`flex items-center gap-1.5 w-full text-left px-2 py-1.5 text-[13px] rounded-[6px] transition-colors group ${selectedDocId === node.id
                        ? 'bg-[#1A1C20] text-[#F2F2F2] font-medium shadow-sm'
                        : 'text-[#8A8F98] hover:bg-white/[0.04] hover:text-[#D1D3D8]'
                        }`}
                >
                    {node.isFolder ? (
                        expandedFolderIds.has(node.id) ? (
                            <ChevronDown className="w-3.5 h-3.5 text-[#5E626B] group-hover:text-[#8A8F98]" />
                        ) : (
                            <ChevronRight className="w-3.5 h-3.5 text-[#5E626B] group-hover:text-[#8A8F98]" />
                        )
                    ) : (
                        <FileText className={`w-3.5 h-3.5 ${selectedDocId === node.id ? 'text-[#D1D3D8]' : 'text-[#5E626B]'}`} />
                    )}

                    {node.isFolder && <Folder className="w-3.5 h-3.5 text-[#5E626B] group-hover:text-[#8A8F98]" />}
                    <span className="truncate">{node.title}</span>
                </button>

                {node.isFolder && expandedFolderIds.has(node.id) && node.children && (
                    <div className="pl-4 space-y-0.5 mt-0.5 border-l border-[#232529] ml-3">
                        {renderTree(node.children)}
                    </div>
                )}
            </div>
        ));
    };

    return (
        <div className="h-full w-full bg-[#111214] text-[#EBEBEB] font-sans flex overflow-hidden">

            {/* Left Pane: Document Tree */}
            <div className="w-[280px] bg-[#111214] border-r border-[#232529] flex flex-col shrink-0">
                <div className="px-5 py-5 flex items-center justify-between shrink-0">
                    <h2 className="text-[15px] font-semibold text-[#F2F2F2]">Knowledge Base</h2>
                    <div className="flex gap-1">
                        <button
                            onClick={() => handleCreate(true)}
                            title="New Folder"
                            className="text-[#8A8F98] hover:text-[#F2F2F2] hover:bg-[#232529] transition-colors p-1.5 rounded-[6px]"
                        >
                            <Folder className="w-3.5 h-3.5" />
                        </button>
                        <button
                            onClick={() => handleCreate(false)}
                            title="New Document"
                            className="text-[#8A8F98] hover:text-[#F2F2F2] hover:bg-[#232529] transition-colors p-1.5 rounded-[6px]"
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                <div className="px-3 pb-3 flex-1 overflow-y-auto">
                    <div className="relative mb-3">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8A8F98]" />
                        <input
                            type="text"
                            placeholder="Search docs..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-[#1A1C20] border border-[#2A2D32] rounded-[6px] py-1.5 pl-8 pr-3 text-[13px] text-[#F2F2F2] placeholder:text-[#5E626B] focus:outline-none focus:border-[#444853] focus:bg-[#232529] transition-colors shadow-inner"
                        />
                    </div>

                    <div className="space-y-1">
                        {searchQuery ? (
                            <div className="space-y-0.5">
                                {searchedDocs.map(doc => (
                                    <button
                                        key={doc.id}
                                        onClick={() => handleSelectDoc(doc)}
                                        className={`flex items-center gap-2 w-full text-left px-2 py-1.5 text-[13px] rounded-[6px] transition-colors ${selectedDocId === doc.id
                                            ? 'bg-[#1A1C20] text-[#F2F2F2] font-medium shadow-sm'
                                            : 'text-[#8A8F98] hover:bg-white/[0.04] hover:text-[#D1D3D8]'
                                            }`}
                                    >
                                        <FileText className={`w-3.5 h-3.5 ${selectedDocId === doc.id ? 'text-[#D1D3D8]' : 'text-[#5E626B]'}`} />
                                        <span className="truncate">{doc.title}</span>
                                    </button>
                                ))}
                                {searchedDocs.length === 0 && (
                                    <div className="text-center py-4 text-[12px] text-[#5E626B]">No documents found</div>
                                )}
                            </div>
                        ) : (
                            renderTree(rootNodes)
                        )}
                    </div>
                </div>
            </div>

            {/* Right Pane: Document Editor */}
            <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#16181A]">
                {!selectedDoc ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-[#5E626B]">
                        <FileText className="w-12 h-12 mb-4 opacity-10" />
                        <p className="text-[14px]">Select a document to read or edit</p>
                    </div>
                ) : (
                    <>
                        {/* Editor Header */}
                        <div className="px-8 py-5 flex items-center justify-between shrink-0 border-b border-[#232529]">
                            <div className="text-[13px] text-[#8A8F98] flex items-center gap-2 font-medium">
                                <div className="flex flex-col gap-1">
                                    <span className="text-[#F2F2F2]">
                                        {isEditing ? (
                                            <input
                                                value={editTitle}
                                                onChange={(e) => setEditTitle(e.target.value)}
                                                className="bg-transparent border-none focus:outline-none text-[#F2F2F2] w-64"
                                            />
                                        ) : selectedDoc.title}
                                    </span>
                                    {isEditing ? (
                                        <input
                                            value={editDescription}
                                            onChange={(e) => setEditDescription(e.target.value)}
                                            className="bg-transparent border-none focus:outline-none text-[#8A8F98] w-96 text-[12px]"
                                            placeholder="Short description"
                                        />
                                    ) : (
                                        <span className="text-[12px] text-[#8A8F98]">
                                            {selectedDoc.description || "No description"}
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-2 text-[#8A8F98]">
                                {isEditing ? (
                                    <>
                                        <button
                                            onClick={handleSave}
                                            className="bg-[#5E6AD2] text-white px-3 py-1 rounded-[6px] text-[12px] font-semibold hover:bg-[#4E5AC2] transition-colors"
                                        >
                                            Save
                                        </button>
                                        <button
                                            onClick={() => setIsEditing(false)}
                                            className="px-3 py-1 rounded-[6px] text-[12px] hover:text-[#F2F2F2] transition-colors"
                                        >
                                            Cancel
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        onClick={() => setIsEditing(true)}
                                        className="flex items-center gap-1.5 hover:text-[#F2F2F2] transition-colors text-[13px] hover:bg-[#232529] px-2 py-1.5 rounded-[6px]"
                                    >
                                        Edit
                                    </button>
                                )}
                                <div className="w-px h-4 bg-[#232529] mx-2" />
                                <button className="hover:text-[#F2F2F2] transition-colors p-1.5 hover:bg-[#232529] rounded-[6px]">
                                    <Clock className="w-4 h-4 text-[#5E626B]" />
                                </button>
                                <button className="hover:text-[#F2F2F2] transition-colors p-1.5 hover:bg-[#232529] rounded-[6px]">
                                    <History className="w-4 h-4" />
                                </button>
                                <button className="hover:text-[#F2F2F2] transition-colors p-1.5 hover:bg-[#232529] rounded-[6px]">
                                    <MoreHorizontal className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Editor Content Area */}
                        <div className="flex-1 overflow-y-auto px-12 py-12">
                            <div className="max-w-3xl mx-auto">
                                {isEditing ? (
                                    <textarea
                                        value={editContent}
                                        onChange={(e) => setEditContent(e.target.value)}
                                        className="w-full h-[calc(100vh-250px)] bg-[#111214] border border-[#232529] rounded-[8px] p-6 text-[15px] leading-relaxed text-[#D1D3D8] focus:outline-none focus:border-[#444853] font-mono shadow-inner resize-none"
                                        placeholder="Write your markdown here..."
                                    />
                                ) : (
                                    <div className="prose prose-invert prose-zinc max-w-none prose-h1:text-3xl prose-h1:font-bold prose-h1:tracking-tight prose-h2:text-[18px] prose-h2:font-semibold prose-h2:border-b prose-h2:border-[#232529] prose-h2:pb-2 prose-p:text-[15px] prose-p:leading-relaxed prose-code:bg-[#232529] prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-[4px] prose-code:text-[13px] prose-pre:bg-[#111214] prose-pre:border prose-pre:border-[#232529] prose-pre:rounded-[8px]">
                                        <ReactMarkdown>
                                            {selectedDoc.content || "_No content. Click Edit to add something._"}
                                        </ReactMarkdown>
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
