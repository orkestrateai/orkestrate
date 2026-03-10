"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
    Bot,
    Book,
    Settings,
    ChevronDown,
    Check,
    LogOut,
    Plus,
    X,
    Pencil,
    Trash2,
    MoreHorizontal,
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

const navigationItems = [
    { name: "Agents", href: "/dashboard", icon: Bot },
    { name: "Knowledge Base", href: "/dashboard/knowledge-base", icon: Book },
];

export default function DashboardTopNav() {
    const pathname = usePathname();
    const router = useRouter();
    const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(false);
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const [rooms, setRooms] = useState<Room[]>([]);
    const [loadingRooms, setLoadingRooms] = useState(false);
    const [savingRoom, setSavingRoom] = useState(false);
    const [roomError, setRoomError] = useState<string | null>(null);
    const [newRoomName, setNewRoomName] = useState("");
    const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
    const [editingRoomName, setEditingRoomName] = useState("");
    const [user, setUser] = useState<{ email?: string; avatar_url?: string; full_name?: string } | null>(null);
    const workspaceRef = useRef<HTMLDivElement>(null);
    const userMenuRef = useRef<HTMLDivElement>(null);

    const activeRoom = rooms.find((r) => r.isActive) || rooms[0] || null;

    // Load user
    useEffect(() => {
        const supabase = createSupabaseBrowserClient();
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) {
                setUser({
                    email: session.user.email || undefined,
                    avatar_url: session.user.user_metadata?.avatar_url,
                    full_name: session.user.user_metadata?.full_name,
                });
            }
        });
    }, []);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (workspaceRef.current && !workspaceRef.current.contains(event.target as Node)) {
                setIsWorkspaceOpen(false);
                setEditingRoomId(null);
                setRoomError(null);
            }
            if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
                setIsUserMenuOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const withToken = useCallback(async <T,>(fn: (token: string) => Promise<T>) => {
        const supabase = createSupabaseBrowserClient();
        const { data: { session } } = await supabase.auth.getSession();
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

    async function handleLogout() {
        try {
            const supabase = createSupabaseBrowserClient();
            await supabase.auth.signOut();
        } finally {
            router.push("/");
            router.refresh();
        }
    }

    async function createRoom() {
        const trimmed = newRoomName.trim();
        setSavingRoom(true);
        setRoomError(null);
        try {
            await withToken(async (token) => {
                const res = await fetch("/api/workspaces", {
                    method: "POST",
                    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
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
                    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
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
        if (!name) { setRoomError("Workspace name cannot be empty."); return; }
        setSavingRoom(true);
        setRoomError(null);
        try {
            await withToken(async (token) => {
                const res = await fetch("/api/workspaces", {
                    method: "POST",
                    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
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
                    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
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

    const isNavActive = (href: string) => {
        if (href === "/dashboard") {
            return pathname === "/dashboard" || pathname.startsWith("/dashboard/agents") || pathname.startsWith("/dashboard/agent-");
        }
        return pathname.startsWith(href);
    };

    return (
        <nav className="w-full bg-white/[0.04] backdrop-blur-xl border-b border-white/10 sticky top-0 z-50">
            <div className="flex items-center justify-between h-[60px] px-6 max-w-[1440px] mx-auto w-full">
                {/* Left: Logo + Workspace */}
                <div className="flex items-center gap-4">
                    <Link href="/" className="hover:opacity-80 transition-opacity shrink-0">
                        <Logo size="sm" withText={false} />
                    </Link>

                    {/* Workspace Switcher */}
                    <div className="relative" ref={workspaceRef}>
                        <button
                            className="flex items-center gap-2 px-2.5 py-1.5 rounded-[8px] hover:bg-white/[0.05] transition-colors group"
                            onClick={() => setIsWorkspaceOpen(!isWorkspaceOpen)}
                        >
                            <div className="w-5 h-5 rounded-[5px] bg-gradient-to-br from-white/10 to-white/5 border border-white/10 flex items-center justify-center text-[10px] font-bold text-white/60">
                                {activeRoom?.name?.[0]?.toUpperCase() || "W"}
                            </div>
                            <span className="text-[13px] font-medium text-[#D1D3D8] max-w-[160px] truncate">
                                {activeRoom?.name || "Workspace"}
                            </span>
                            <ChevronDown className="w-3 h-3 text-[#5E626B] group-hover:text-[#8A8F98] transition-colors" />
                        </button>

                        {isWorkspaceOpen && (
                            <div className="absolute top-full left-0 mt-2 w-[300px] bg-[#16181A] border border-[#232529] rounded-[12px] shadow-2xl overflow-hidden text-[13px] text-[#8A8F98] z-50">
                                <div className="p-3 border-b border-[#1E2024]">
                                    <div className="flex items-center gap-2 mb-3">
                                        <input
                                            type="text"
                                            value={newRoomName}
                                            onChange={(e) => setNewRoomName(e.target.value)}
                                            placeholder="New workspace name"
                                            className="flex-1 bg-[#111214] border border-[#232529] rounded-[6px] py-1.5 px-2.5 text-[12px] text-[#F2F2F2] placeholder:text-[#3A3F4A] focus:outline-none focus:border-[#3A3F4A]"
                                        />
                                        <button
                                            onClick={() => void createRoom()}
                                            disabled={savingRoom}
                                            className="flex items-center gap-1 bg-white/[0.06] hover:bg-white/[0.1] border border-[#232529] rounded-[6px] px-2.5 py-1.5 text-[#D1D3D8] text-[12px] transition-colors disabled:opacity-50"
                                        >
                                            <Plus className="w-3 h-3" />
                                        </button>
                                    </div>
                                </div>

                                <div className="p-2 max-h-64 overflow-y-auto">
                                    {rooms.map((room) => (
                                        <div
                                            key={room.id}
                                            className="flex items-center justify-between px-2 py-1.5 rounded-[6px] hover:bg-white/[0.04] transition-colors group"
                                        >
                                            <div className="flex items-center gap-2 min-w-0 flex-1">
                                                <div className="w-5 h-5 rounded-[4px] bg-white/[0.06] flex items-center justify-center shrink-0 text-[10px] font-bold text-white/40">
                                                    {room.name?.[0]?.toUpperCase() || "W"}
                                                </div>

                                                {editingRoomId === room.id ? (
                                                    <input
                                                        value={editingRoomName}
                                                        onChange={(e) => setEditingRoomName(e.target.value)}
                                                        className="flex-1 bg-[#111214] border border-[#2A2D32] rounded-[4px] py-0.5 px-2 text-[12px] text-[#F2F2F2] focus:outline-none focus:border-[#444853]"
                                                    />
                                                ) : (
                                                    <button
                                                        onClick={() => void switchRoom(room.id)}
                                                        className="text-[#D1D3D8] font-medium truncate text-left text-[12px]"
                                                    >
                                                        {room.name}
                                                    </button>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-0.5 shrink-0 ml-2">
                                                {room.isActive && <Check className="w-3.5 h-3.5 text-white/60" />}

                                                {editingRoomId === room.id ? (
                                                    <>
                                                        <button onClick={() => void renameRoom(room.id)} disabled={savingRoom} className="p-1 rounded text-[#5E626B] hover:text-emerald-400 hover:bg-white/[0.04]">
                                                            <Check className="w-3 h-3" />
                                                        </button>
                                                        <button onClick={() => { setEditingRoomId(null); setEditingRoomName(""); }} className="p-1 rounded text-[#5E626B] hover:text-[#D1D3D8] hover:bg-white/[0.04]">
                                                            <X className="w-3 h-3" />
                                                        </button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <button
                                                            onClick={() => { setEditingRoomId(room.id); setEditingRoomName(room.name); }}
                                                            className="p-1 rounded text-[#3A3F4A] hover:text-[#D1D3D8] hover:bg-white/[0.04] opacity-0 group-hover:opacity-100 transition-opacity"
                                                        >
                                                            <Pencil className="w-3 h-3" />
                                                        </button>
                                                        <button
                                                            onClick={() => void deleteRoom(room.id)}
                                                            disabled={room.isActive || savingRoom}
                                                            className="p-1 rounded text-[#3A3F4A] hover:text-red-400 hover:bg-white/[0.04] opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-20 disabled:cursor-not-allowed"
                                                        >
                                                            <Trash2 className="w-3 h-3" />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                    {!loadingRooms && rooms.length === 0 && (
                                        <div className="px-2 py-3 text-center text-[12px] text-[#3A3F4A]">No workspaces found.</div>
                                    )}
                                </div>

                                {roomError && (
                                    <div className="px-3 py-2 border-t border-[#1E2024] text-[11px] text-red-400">{roomError}</div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="w-px h-5 bg-white/[0.06]" />

                    {/* Nav Tabs */}
                    <div className="flex items-center gap-0.5">
                        {navigationItems.map((item) => {
                            const active = isNavActive(item.href);
                            return (
                                <Link
                                    href={item.href}
                                    key={item.name}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-[8px] text-[13px] transition-all ${active
                                        ? "bg-white/[0.08] text-[#F2F2F2] font-medium"
                                        : "text-[#8A8F98] hover:text-[#D1D3D8] hover:bg-white/[0.04]"
                                        }`}
                                >
                                    <item.icon className="w-3.5 h-3.5" />
                                    <span>{item.name}</span>
                                </Link>
                            );
                        })}
                    </div>
                </div>

                {/* Right: User Menu */}
                <div className="flex items-center gap-3">
                    <Link
                        href="/dashboard/settings"
                        className={`p-1.5 rounded-[6px] transition-colors ${pathname === "/dashboard/settings"
                            ? "text-[#F2F2F2] bg-white/[0.08]"
                            : "text-[#5E626B] hover:text-[#8A8F98] hover:bg-white/[0.04]"
                            }`}
                    >
                        <Settings className="w-4 h-4" />
                    </Link>

                    <div className="relative" ref={userMenuRef}>
                        <button
                            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                            className="flex items-center gap-2 rounded-full hover:ring-2 hover:ring-white/10 transition-all"
                        >
                            {user?.avatar_url ? (
                                <img
                                    src={user.avatar_url}
                                    alt="User"
                                    className="w-7 h-7 rounded-full object-cover border border-white/10"
                                    referrerPolicy="no-referrer"
                                />
                            ) : (
                                <div className="w-7 h-7 rounded-full bg-white/[0.08] border border-white/10 flex items-center justify-center text-[11px] font-bold text-white/50">
                                    {user?.full_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "?"}
                                </div>
                            )}
                        </button>

                        {isUserMenuOpen && (
                            <div className="absolute top-full right-0 mt-2 w-[220px] bg-[#16181A] border border-[#232529] rounded-[10px] shadow-2xl overflow-hidden z-50">
                                <div className="px-3 py-3 border-b border-[#1E2024]">
                                    <div className="text-[13px] text-[#D1D3D8] font-medium truncate">
                                        {user?.full_name || "User"}
                                    </div>
                                    <div className="text-[11px] text-[#5E626B] truncate">
                                        {user?.email || ""}
                                    </div>
                                </div>
                                <div className="p-1.5">
                                    <Link
                                        href="/dashboard/settings"
                                        className="flex items-center gap-2.5 px-2.5 py-2 rounded-[6px] text-[13px] text-[#8A8F98] hover:text-[#D1D3D8] hover:bg-white/[0.04] transition-colors"
                                    >
                                        <Settings className="w-3.5 h-3.5" />
                                        Settings
                                    </Link>
                                    <button
                                        onClick={() => void handleLogout()}
                                        className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-[6px] text-[13px] text-red-400/80 hover:text-red-400 hover:bg-red-500/[0.06] transition-colors"
                                    >
                                        <LogOut className="w-3.5 h-3.5" />
                                        Log out
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </nav>
    );
}
