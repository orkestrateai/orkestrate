"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    Search,
    MoreHorizontal,
    FileText,
    ChevronRight,
    ChevronDown,
    Plus,
    Clock,
    History,
    Folder,
    Trash2,
    Save,
    AlertTriangle,
    Edit3,
    ArrowUpRight
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
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [isAutoSaving, setIsAutoSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const [showMoveMenu, setShowMoveMenu] = useState<string | null>(null);
    const [isRenaming, setIsRenaming] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState('');
    const [showUnsavedConfirm, setShowUnsavedConfirm] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
    const originalContentRef = useRef({ content: '', title: '', description: '' });

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

    // Track unsaved changes
    useEffect(() => {
        if (selectedDoc && isEditing) {
            const hasChanges =
                editContent !== originalContentRef.current.content ||
                editTitle !== originalContentRef.current.title ||
                editDescription !== originalContentRef.current.description;
            setHasUnsavedChanges(hasChanges);
        }
    }, [editContent, editTitle, editDescription, selectedDoc, isEditing]);

    // Responsive textarea - auto-resize
    useEffect(() => {
        if (isEditing && textareaRef.current) {
            const textarea = textareaRef.current;
            textarea.style.height = 'auto';
            textarea.style.height = Math.max(400, textarea.scrollHeight) + 'px';
        }
    }, [editContent, isEditing]);

    // Auto-save with debounce
    const autoSave = useCallback(async () => {
        if (!selectedDoc || !activeRoomId || !hasUnsavedChanges) return;

        setIsAutoSaving(true);
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
            originalContentRef.current = { content: editContent, title: editTitle, description: editDescription };
            setHasUnsavedChanges(false);
            setLastSaved(new Date());
            void mutateKnowledge();
        }
        setIsAutoSaving(false);
    }, [selectedDoc, activeRoomId, hasUnsavedChanges, editTitle, editDescription, editContent, mutateKnowledge]);

    // Set up auto-save timer
    useEffect(() => {
        if (hasUnsavedChanges && isEditing) {
            if (autoSaveTimerRef.current) {
                clearTimeout(autoSaveTimerRef.current);
            }
            autoSaveTimerRef.current = setTimeout(() => {
                autoSave();
            }, 2000); // Auto-save after 2 seconds of inactivity
        }
        return () => {
            if (autoSaveTimerRef.current) {
                clearTimeout(autoSaveTimerRef.current);
            }
        };
    }, [hasUnsavedChanges, isEditing, autoSave]);

    // Warn before leaving with unsaved changes
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (hasUnsavedChanges) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [hasUnsavedChanges]);

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
            originalContentRef.current = {
                content: doc.content,
                title: doc.title,
                description: doc.description || ''
            };
            setIsEditing(false);
            setHasUnsavedChanges(false);
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

    const handleDelete = async (docId: string) => {
        if (!activeRoomId) return;

        const supabase = createSupabaseBrowserClient();
        const { data: { session } } = await supabase.auth.getSession();

        const res = await fetch(`/api/knowledge?id=${docId}&workspaceId=${activeRoomId}`, {
            method: "DELETE",
            headers: {
                Authorization: `Bearer ${session?.access_token}`,
            },
        });

        if (res.ok) {
            if (selectedDocId === docId) {
                setSelectedDocId(null);
            }
            setDeleteConfirmId(null);
            void mutateKnowledge();
        }
    };

    const handleRename = async (docId: string) => {
        if (!activeRoomId || !renameValue.trim()) return;

        const supabase = createSupabaseBrowserClient();
        const { data: { session } } = await supabase.auth.getSession();

        const res = await fetch("/api/knowledge", {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session?.access_token}`,
            },
            body: JSON.stringify({
                id: docId,
                workspaceId: activeRoomId,
                title: renameValue.trim(),
            }),
        });

        if (res.ok) {
            setIsRenaming(null);
            setRenameValue('');
            void mutateKnowledge();
        }
    };

    const handleMove = async (docId: string, newParentId: string | null) => {
        if (!activeRoomId) return;

        const supabase = createSupabaseBrowserClient();
        const { data: { session } } = await supabase.auth.getSession();

        const res = await fetch("/api/knowledge", {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session?.access_token}`,
            },
            body: JSON.stringify({
                id: docId,
                workspaceId: activeRoomId,
                parentId: newParentId,
            }),
        });

        if (res.ok) {
            setShowMoveMenu(null);
            void mutateKnowledge();
        }
    };

    const startRename = (doc: DocNode) => {
        setIsRenaming(doc.id);
        setRenameValue(doc.title);
    };

    const startMove = (docId: string) => {
        setShowMoveMenu(docId);
    };

    const renderTree = (nodes: DocNode[], excludeId?: string) => {
        return nodes.map(node => {
            if (node.id === excludeId) return null;
            return (
                <div key={node.id}>
                    {isRenaming === node.id ? (
                        <div className="flex items-center gap-1 px-2 py-1">
                            {node.isFolder ? (
                                <ChevronDown className="w-3.5 h-3.5 text-[#5E626B]" />
                            ) : (
                                <FileText className="w-3.5 h-3.5 text-[#5E626B]" />
                            )}
                            {node.isFolder && <Folder className="w-3.5 h-3.5 text-[#5E626B]" />}
                            <input
                                type="text"
                                value={renameValue}
                                onChange={(e) => setRenameValue(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleRename(node.id);
                                    if (e.key === 'Escape') { setIsRenaming(null); setRenameValue(''); }
                                }}
                                onBlur={() => handleRename(node.id)}
                                autoFocus
                                className="flex-1 bg-[#1A1C20] border border-[#5E6AD2] rounded-[4px] px-2 py-0.5 text-[13px] text-[#F2F2F2] focus:outline-none"
                            />
                        </div>
                    ) : (
                        <div className="flex items-center group">
                            <button
                                onClick={() => handleSelectDoc(node)}
                                className={`flex items-center gap-1.5 flex-1 text-left px-2 py-1.5 text-[13px] rounded-[6px] transition-colors ${selectedDocId === node.id
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
                            <button
                                onClick={(e) => { e.stopPropagation(); startRename(node); }}
                                className="opacity-0 group-hover:opacity-100 p-1 hover:text-[#F2F2F2] text-[#5E626B] transition-opacity"
                                title="Rename"
                            >
                                <Edit3 className="w-3 h-3" />
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); startMove(node.id); }}
                                className="opacity-0 group-hover:opacity-100 p-1 hover:text-[#F2F2F2] text-[#5E626B] transition-opacity"
                                title="Move"
                            >
                                <ArrowUpRight className="w-3 h-3" />
                            </button>
                        </div>
                    )}

                    {/* Move Menu */}
                    {showMoveMenu === node.id && (
                        <div className="ml-6 mt-1 bg-[#1A1C20] border border-[#232529] rounded-[6px] p-2 text-[12px]">
                            <div className="text-[#8A8F98] mb-2 px-1">Move to:</div>
                            <button
                                onClick={() => handleMove(showMoveMenu, null)}
                                className="w-full text-left px-2 py-1.5 rounded-[4px] text-[#D1D3D8] hover:bg-[#232529]"
                            >
                                Root
                            </button>
                            {rawDocs.filter(d => d.isFolder && d.id !== node.id).map(folder => (
                                <button
                                    key={folder.id}
                                    onClick={() => handleMove(showMoveMenu, folder.id)}
                                    className="w-full text-left px-2 py-1.5 rounded-[4px] text-[#D1D3D8] hover:bg-[#232529] flex items-center gap-2"
                                >
                                    <Folder className="w-3 h-3" />
                                    {folder.title}
                                </button>
                            ))}
                            {rawDocs.filter(d => d.isFolder && d.id !== node.id).length === 0 && (
                                <div className="px-2 py-1 text-[#5E626B]">No folders available</div>
                            )}
                        </div>
                    )}

                    {node.isFolder && expandedFolderIds.has(node.id) && node.children && (
                        <div className="pl-4 space-y-0.5 mt-0.5 border-l border-[#232529] ml-3">
                            {renderTree(node.children, excludeId)}
                        </div>
                    )}
                </div>
            );
        });
    };

    return (
        <div className="h-full w-full bg-[#050505] text-[#F2F2F2] font-sans flex overflow-hidden">

            {/* Left Pane: Document Tree */}
            <div className="w-[280px] bg-[#050505] border-r border-white/10 flex flex-col shrink-0">
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
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                        <input
                            type="text"
                            placeholder="Search docs..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-white/[0.04] border border-white/10 rounded-full py-2 pl-9 pr-4 text-[13px] text-white placeholder:text-white/30 focus:outline-none focus:border-white/20 focus:bg-white/[0.06] transition-all shadow-sm focus:shadow-[0_0_15px_rgba(255,255,255,0.05)]"
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
            <div className="flex-1 flex flex-col h-full overflow-hidden bg-transparent">
                {!selectedDoc ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-[#5E626B]">
                        <FileText className="w-12 h-12 mb-4 opacity-10" />
                        <p className="text-[14px]">Select a document to read or edit</p>
                    </div>
                ) : (
                    <>
                        {/* Editor Header */}
                        <div className="px-8 py-5 flex items-center justify-between shrink-0 border-b border-white/10">
                            <div className="text-[13px] text-[#8A8F98] flex items-center gap-2 font-medium flex-1">
                                <div className="flex flex-col gap-1 flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[#F2F2F2]">
                                            {isEditing ? (
                                                <input
                                                    value={editTitle}
                                                    onChange={(e) => setEditTitle(e.target.value)}
                                                    className="bg-transparent border-none focus:outline-none text-[#F2F2F2] w-64"
                                                />
                                            ) : selectedDoc.title}
                                        </span>
                                        {hasUnsavedChanges && (
                                            <span className="flex items-center gap-1 text-[11px] text-[#FFB84D] bg-[#FFB84D]/10 px-2 py-0.5 rounded-full">
                                                <AlertTriangle className="w-3 h-3" />
                                                Unsaved
                                            </span>
                                        )}
                                        {isAutoSaving && (
                                            <span className="flex items-center gap-1 text-[11px] text-[#5E6AD2]">
                                                <Save className="w-3 h-3 animate-pulse" />
                                                Saving...
                                            </span>
                                        )}
                                        {!hasUnsavedChanges && lastSaved && !isAutoSaving && (
                                            <span className="text-[11px] text-[#5E626B]">
                                                Saved
                                            </span>
                                        )}
                                    </div>
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
                                            onClick={() => {
                                                if (hasUnsavedChanges) {
                                                    setShowUnsavedConfirm(true);
                                                } else {
                                                    setIsEditing(false);
                                                }
                                            }}
                                            className="px-3 py-1 rounded-[6px] text-[12px] hover:text-[#F2F2F2] transition-colors"
                                        >
                                            Cancel
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <button
                                            onClick={() => setIsEditing(true)}
                                            className="flex items-center gap-1.5 hover:text-[#F2F2F2] transition-colors text-[13px] hover:bg-[#232529] px-2 py-1.5 rounded-[6px]"
                                        >
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => setDeleteConfirmId(selectedDoc.id)}
                                            className="flex items-center gap-1.5 hover:text-[#FF6B6B] transition-colors text-[13px] hover:bg-[#232529] px-2 py-1.5 rounded-[6px]"
                                            title="Delete"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </>
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
                                        ref={textareaRef}
                                        value={editContent}
                                        onChange={(e) => setEditContent(e.target.value)}
                                        className="w-full min-h-[400px] bg-white/[0.02] border border-white/10 rounded-[12px] p-6 text-[15px] leading-relaxed text-[#F2F2F2] focus:outline-none focus:border-white/20 font-mono shadow-inner resize-none transition-colors"
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

            {/* Delete Confirmation Modal */}
            {deleteConfirmId && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
                    <div className="bg-[#1A1C20] border border-[#232529] rounded-[12px] p-6 max-w-md w-full mx-4 shadow-2xl">
                        <h3 className="text-[16px] font-semibold text-[#F2F2F2] mb-2">Delete {rawDocs.find(d => d.id === deleteConfirmId)?.isFolder ? 'Folder' : 'Document'}?</h3>
                        <p className="text-[14px] text-[#8A8F98] mb-6">
                            {rawDocs.find(d => d.id === deleteConfirmId)?.isFolder
                                ? 'This will permanently delete this folder and all documents inside it. This action cannot be undone.'
                                : 'This will permanently delete this document. This action cannot be undone.'}
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setDeleteConfirmId(null)}
                                className="px-4 py-2 rounded-[6px] text-[13px] text-[#D1D3D8] hover:bg-[#232529] transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleDelete(deleteConfirmId)}
                                className="px-4 py-2 rounded-[6px] text-[13px] bg-[#FF6B6B] text-white font-semibold hover:bg-[#FF5252] transition-colors"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Unsaved Changes Confirmation Modal */}
            {showUnsavedConfirm && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
                    <div className="bg-[#1A1C20] border border-[#232529] rounded-[12px] p-6 max-w-md w-full mx-4 shadow-2xl">
                        <h3 className="text-[16px] font-semibold text-[#F2F2F2] mb-2">Unsaved Changes</h3>
                        <p className="text-[14px] text-[#8A8F98] mb-6">
                            You have unsaved changes. Do you want to discard them?
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setShowUnsavedConfirm(false)}
                                className="px-4 py-2 rounded-[6px] text-[13px] text-[#D1D3D8] hover:bg-[#232529] transition-colors"
                            >
                                Keep Editing
                            </button>
                            <button
                                onClick={() => {
                                    originalContentRef.current = { content: editContent, title: editTitle, description: editDescription };
                                    setHasUnsavedChanges(false);
                                    setIsEditing(false);
                                    setShowUnsavedConfirm(false);
                                }}
                                className="px-4 py-2 rounded-[6px] text-[13px] bg-[#FF6B6B] text-white font-semibold hover:bg-[#FF5252] transition-colors"
                            >
                                Discard Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
