"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
    Search,
    Inbox,
    Bot,
    Book,
    Database,
    History,
    Settings,
    ChevronDown,
    Check,
    LogOut,
    Plus,
    X,
    MoreHorizontal,
    Pencil,
    Trash2
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";
import { Logo } from "@/components/brand/Logo";

type Room = {
    id: string;
    name: string;
    isActive: boolean;
    projectCount?: number;
    activeTaskCount?: number;
};

// No complex task/project primitives anymore as per requirements

const navigationItems = [
    { name: "Inbox", href: "/dashboard", icon: Inbox },
    { name: "Agents", href: "/dashboard/agents", icon: Bot },
    { name: "Agent State", href: "/dashboard/agent-state", icon: Database },
    { name: "Knowledge Base", href: "/dashboard/knowledge-base", icon: Book },
];

export default function GlobalSidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(false);
    const [rooms, setRooms] = useState<Room[]>([]);
    const [loadingRooms, setLoadingRooms] = useState(false);
    const [savingRoom, setSavingRoom] = useState(false);
    const [roomError, setRoomError] = useState<string | null>(null);
    const [newRoomName, setNewRoomName] = useState("");
    const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
    const [editingRoomName, setEditingRoomName] = useState("");
    const workspaceRef = useRef<HTMLDivElement>(null);

    const activeRoom = rooms.find((r) => r.isActive) || rooms[0] || null;

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (workspaceRef.current && !workspaceRef.current.contains(event.target as Node)) {
                setIsWorkspaceOpen(false);
                setEditingRoomId(null);
                setRoomError(null);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const withToken = useCallback(async <T,>(fn: (token: string) => Promise<T>) => {
        const supabase = createSupabaseBrowserClient();
        const {
            data: { session },
        } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) throw new Error("Not authenticated");
        return fn(token);
    }, []);

    const loadRooms = useCallback(async () => {
        setLoadingRooms(true);
        try {
            const data = await withToken(async (token) => {
                const res = await fetch("/api/workspaces", {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (!res.ok) throw new Error(`Failed to load rooms (${res.status})`);
                return res.json();
            });
            setRooms(Array.isArray(data?.rooms) ? data.rooms : []);
        } catch {
            setRooms([]);
            setRoomError("Failed to load workspaces.");
        } finally {
            setLoadingRooms(false);
        }
    }, [withToken]);

    useEffect(() => {
        void loadRooms();
    }, [loadRooms]);

    async function createRoom() {
        const trimmed = newRoomName.trim();
        setSavingRoom(true);
        setRoomError(null);
        try {
            await withToken(async (token) => {
                const res = await fetch("/api/workspaces", {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ action: "create", name: trimmed || undefined }),
                });
                if (!res.ok) throw new Error(`Failed to create room (${res.status})`);
            });
            setNewRoomName("");
            await loadRooms();
            router.refresh();
        } catch {
            setRoomError("Could not create workspace.");
        } finally {
            setSavingRoom(false);
        }
    }

    async function switchRoom(roomId: string) {
        setRoomError(null);
        try {
            await withToken(async (token) => {
                const res = await fetch("/api/workspaces", {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ action: "switch", roomId }),
                });
                if (!res.ok) throw new Error(`Failed to switch room (${res.status})`);
            });
            await loadRooms();
            router.refresh();
        } catch {
            setRoomError("Could not switch workspace.");
        }
    }

    async function renameRoom(roomId: string) {
        const name = editingRoomName.trim();
        if (!name) {
            setRoomError("Workspace name cannot be empty.");
            return;
        }
        setSavingRoom(true);
        setRoomError(null);
        try {
            await withToken(async (token) => {
                const res = await fetch("/api/workspaces", {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ action: "rename", roomId, name }),
                });
                if (!res.ok) throw new Error(`Failed to rename room (${res.status})`);
            });
            setEditingRoomId(null);
            setEditingRoomName("");
            await loadRooms();
            router.refresh();
        } catch {
            setRoomError("Could not rename workspace.");
        } finally {
            setSavingRoom(false);
        }
    }

    async function deleteRoom(roomId: string) {
        setSavingRoom(true);
        setRoomError(null);
        try {
            await withToken(async (token) => {
                const res = await fetch("/api/workspaces", {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ action: "delete", roomId }),
                });
                if (!res.ok) throw new Error(`Failed to delete room (${res.status})`);
            });
            await loadRooms();
            router.refresh();
        } catch {
            setRoomError("Only non-active workspaces can be deleted.");
        } finally {
            setSavingRoom(false);
        }
    }

    return (
        <div className="w-[240px] flex-shrink-0 bg-[#16181A] border-r border-[#232529] flex flex-col font-sans text-[14px] text-[#F2F2F2] h-full selection:bg-indigo-500/30">
            <div className="relative z-50" ref={workspaceRef}>
                <div
                    className="px-3 py-3 flex items-center group cursor-pointer hover:bg-[#1A1C20] transition-colors"
                    onClick={() => setIsWorkspaceOpen(!isWorkspaceOpen)}
                >
                    <div className="min-w-0 flex-1">
                        <Logo size="sm" withText={true} />
                        <span className="block text-[11px] text-[#8A8F98] mt-1 truncate">
                            {activeRoom?.name || "Workspace"}
                        </span>
                    </div>
                    <ChevronDown className="w-4 h-4 text-[#909090] opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>

                {isWorkspaceOpen && (
                    <div className="absolute top-full left-2 mt-1 w-[300px] bg-[#16181A] border border-[#232529] rounded-[8px] shadow-2xl overflow-hidden flex flex-col text-[13px] text-[#8A8F98]">
                        <div className="p-3">
                            <div className="flex items-center gap-3 mb-3">
                                <Logo size="sm" withText={false} />
                                <div className="flex flex-col min-w-0">
                                    <span className="font-semibold text-zinc-100 truncate text-[14px]">
                                        {activeRoom?.name || "No workspace"}
                                    </span>
                                    <span className="text-[11px] text-zinc-500">
                                        {loadingRooms ? "Loading..." : `${rooms.length} workspace${rooms.length === 1 ? "" : "s"}`}
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <Link href="/dashboard/settings" className="flex-1 flex items-center justify-center gap-1.5 bg-[#1A1C20] hover:bg-[#232529] border border-[#232529] rounded-[4px] py-1.5 transition-colors text-[#EBEBEB]">
                                    <Settings className="w-3.5 h-3.5" />
                                    <span>Settings</span>
                                </Link>
                            </div>
                        </div>

                        <div className="h-[1px] bg-[#232529] w-full" />

                        <div className="p-2">
                            <div className="px-2 py-1.5 flex items-center justify-between text-[11px] text-zinc-500 font-medium mb-1">
                                <span>Workspaces</span>
                                <MoreHorizontal className="w-3.5 h-3.5 text-zinc-600" />
                            </div>

                            <div className="space-y-2 mb-3 px-2">
                                <input
                                    type="text"
                                    value={newRoomName}
                                    onChange={(e) => setNewRoomName(e.target.value)}
                                    placeholder="New workspace name"
                                    className="w-full bg-[#1A1C20] border border-[#2A2D32] rounded-[6px] py-1.5 px-2.5 text-[12px] text-[#F2F2F2] placeholder:text-[#5E626B] focus:outline-none focus:border-[#444853]"
                                />
                                <button
                                    onClick={() => void createRoom()}
                                    disabled={savingRoom}
                                    className="w-full flex items-center justify-center gap-1.5 bg-[#1A1C20] hover:bg-[#232529] border border-[#232529] rounded-[6px] py-1.5 transition-colors text-[#EBEBEB] disabled:opacity-50"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    <span>Create workspace</span>
                                </button>
                            </div>

                            <div className="max-h-56 overflow-y-auto space-y-1">
                                {rooms.map((room) => (
                                    <div
                                        key={room.id}
                                        className="w-full flex items-center justify-between px-2 py-1.5 rounded-[4px] hover:bg-white/[0.05] transition-colors group"
                                    >
                                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                            <div className="w-5 h-5 rounded-[4px] bg-[#333] flex items-center justify-center shrink-0 text-zinc-300 font-medium text-[11px]">
                                                {room.name?.[0]?.toUpperCase() || "W"}
                                            </div>

                                            {editingRoomId === room.id ? (
                                                <input
                                                    value={editingRoomName}
                                                    onChange={(e) => setEditingRoomName(e.target.value)}
                                                    className="w-full bg-[#1A1C20] border border-[#2A2D32] rounded-[4px] py-1 px-2 text-[12px] text-[#F2F2F2] focus:outline-none focus:border-[#444853]"
                                                />
                                            ) : (
                                                <button
                                                    onClick={() => void switchRoom(room.id)}
                                                    className="text-zinc-200 font-medium truncate text-left"
                                                >
                                                    {room.name}
                                                </button>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-1 shrink-0 ml-2">
                                            {room.isActive && <Check className="w-4 h-4 text-zinc-200" />}

                                            {editingRoomId === room.id ? (
                                                <>
                                                    <button
                                                        onClick={() => void renameRoom(room.id)}
                                                        disabled={savingRoom}
                                                        className="p-1 rounded text-zinc-400 hover:text-emerald-400 hover:bg-[#2A2D32]"
                                                        title="Save name"
                                                    >
                                                        <Check className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setEditingRoomId(null);
                                                            setEditingRoomName("");
                                                        }}
                                                        className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-[#2A2D32]"
                                                        title="Cancel"
                                                    >
                                                        <X className="w-3.5 h-3.5" />
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <button
                                                        onClick={() => {
                                                            setEditingRoomId(room.id);
                                                            setEditingRoomName(room.name);
                                                        }}
                                                        className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-[#2A2D32] opacity-0 group-hover:opacity-100 transition-opacity"
                                                        title="Rename workspace"
                                                    >
                                                        <Pencil className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={() => void deleteRoom(room.id)}
                                                        disabled={room.isActive || savingRoom}
                                                        className="p-1 rounded text-zinc-500 hover:text-red-400 hover:bg-[#2A2D32] opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
                                                        title={room.isActive ? "Active workspace cannot be deleted" : "Delete workspace"}
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                {!loadingRooms && rooms.length === 0 && (
                                    <div className="px-2 py-2 text-[12px] text-zinc-500">No workspaces found.</div>
                                )}
                            </div>

                            {roomError && (
                                <div className="mt-2 px-2 text-[11px] text-red-400">{roomError}</div>
                            )}
                        </div>

                        <div className="h-[1px] bg-[#232529] w-full" />
                    </div>
                )}
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-2 mt-4 space-y-6 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                <div className="space-y-[1px]">
                    <button className="flex items-center gap-2.5 w-full text-[#A1A1A1] hover:bg-white/[0.055] px-2 py-1.5 rounded-[4px] transition-colors group mb-2">
                        <Search className="w-4 h-4" />
                        <span className="text-[14px]">Search</span>
                    </button>

                    {navigationItems.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                href={item.href}
                                key={item.name}
                                className={`flex items-center gap-2.5 w-full px-2 py-1.5 rounded-[4px] transition-colors ${isActive
                                    ? "bg-white/[0.08] text-[#EBEBEB] font-medium"
                                    : "text-[#A1A1A1] hover:bg-white/[0.055]"
                                    }`}
                            >
                                <item.icon className="w-4 h-4" />
                                <span>{item.name}</span>
                            </Link>
                        );
                    })}
                </div>

                <div>
                    <Link
                        href="/dashboard/history"
                        className={`flex items-center gap-2.5 w-full px-2 py-1.5 rounded-[4px] transition-colors ${pathname === "/dashboard/history"
                            ? "bg-white/[0.08] text-[#EBEBEB] font-medium"
                            : "text-[#A1A1A1] hover:bg-white/[0.055]"
                            }`}
                    >
                        <History className="w-4 h-4 shrink-0" />
                        <span className="truncate">History</span>
                    </Link>
                </div>
            </div>

            <div className="px-3 py-3 mt-auto flex flex-col gap-1">
                <Link href="/dashboard/settings" className="flex items-center gap-2.5 w-full text-[#8A8F98] hover:text-[#F2F2F2] hover:bg-[#1A1C20] px-2 py-1 rounded-[4px] transition-colors">
                    <Settings className="w-4 h-4 shrink-0" />
                    <span className="text-[14px]">Settings</span>
                </Link>
                <button className="flex items-center gap-2.5 w-full text-red-500/80 hover:text-red-400 hover:bg-white/[0.055] px-2 py-1 rounded-[4px] transition-colors">
                    <LogOut className="w-4 h-4 shrink-0" />
                    <span className="text-[14px]">Log out</span>
                </button>
            </div>
        </div>
    );
}

