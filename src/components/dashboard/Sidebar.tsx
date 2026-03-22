"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bot,
  Book,
  Settings,
  Plus,
  LayoutDashboard,
  LogOut,
  ArrowUpCircle,
  ChevronsUpDown,
  Search,
  FolderKanban,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";
import { Session } from "@supabase/supabase-js";
import { motion, AnimatePresence } from "motion/react";

type Workspace = {
  id: string;
  name: string;
  isActive: boolean;
  updatedAt?: string;
};

// ── Tooltip ──────────────────────────────────────────────────────────────────
function Tooltip({
  label,
  side = "right",
}: {
  label: string;
  side?: "left" | "right";
}) {
  return (
    <div
      className={`
        absolute z-50 px-2 py-1 rounded-md bg-[#1A1C20] border border-white/10
        text-xs font-medium text-zinc-200 whitespace-nowrap
        pointer-events-none opacity-0 group-hover:opacity-100
        transition-opacity duration-150
        ${side === "right" ? "left-full ml-2" : "right-full mr-2"}
      `}
    >
      {label}
    </div>
  );
}

// ── IconWrapper ───────────────────────────────────────────────────────────────
function IconWrapper({
  children,
  active,
}: {
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <div
      className={`
        w-6 h-6 rounded-lg flex items-center justify-center shrink-0
        ${active ? "bg-zinc-700/60" : "bg-zinc-800/50 border border-white/10"}
      `}
    >
      {children}
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem("sidebar-collapsed") === "true";
    } catch {
      return false;
    }
  });
  const [user, setUser] = useState<{
    email?: string;
    avatar_url?: string;
    full_name?: string;
  } | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const loadWorkspaces = async (token: string) => {
    const res = await fetch("/api/workspaces", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      setWorkspaces(Array.isArray(data?.workspaces) ? data.workspaces : []);
    }
  };

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth
      .getSession()
      .then(({ data: { session } }: { data: { session: Session | null } }) => {
        if (session?.user) {
          setUser({
            email: session.user.email || undefined,
            avatar_url: session.user.user_metadata?.avatar_url,
            full_name: session.user.user_metadata?.full_name,
          });
          loadWorkspaces(session.access_token);
        }
      });
  }, []);

  const isNavActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  async function handleLogout() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/");
  }

  // ── Workspace context ────────────────────────────────────────────────────────
  const isInWorkspace =
    pathname.includes("/dashboard/workspaces/") && !pathname.endsWith("/new");
  const parts = pathname.split("/");
  const workspaceId: string | null = isInWorkspace ? (parts[3] ?? null) : null;
  const workspaceBase = workspaceId
    ? `/dashboard/workspaces/${workspaceId}`
    : null;

  const workspaceNavItems = workspaceBase
    ? [
        {
          href: workspaceBase,
          icon: <LayoutDashboard className="w-4 h-4 text-zinc-400" />,
          label: "Overview",
        },
        {
          href: `${workspaceBase}/agents`,
          icon: <Bot className="w-4 h-4 text-zinc-400" />,
          label: "Agents",
        },
        {
          href: `${workspaceBase}/knowledge-base`,
          icon: <Book className="w-4 h-4 text-zinc-400" />,
          label: "Knowledge Base",
        },
        {
          href: `${workspaceBase}/settings`,
          icon: <Settings className="w-4 h-4 text-zinc-400" />,
          label: "Settings",
        },
      ]
    : [];

  return (
    <aside
      className={`
        relative h-screen bg-[#0A0A0B] border-r border-white/5
        flex flex-col z-50 overflow-hidden shrink-0
        transition-[width] duration-200 ease-ease
        ${collapsed ? "w-16" : "w-64"}
      `}
    >
      {/* ── Logo / toggle ── */}
      <div
        className={`flex items-center ${collapsed ? "justify-center px-0" : "justify-between px-4"} py-5`}
      >
        {!collapsed && (
          <Link
            href="/dashboard"
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <span className="text-xl font-bold text-zinc-100 tracking-tight">
              Orkestrate
            </span>
          </Link>
        )}
        <button
          onClick={() => {
            const next = !collapsed;
            setCollapsed(next);
            try {
              localStorage.setItem("sidebar-collapsed", String(next));
            } catch {}
          }}
          className="p-1.5 text-zinc-500 hover:text-zinc-300 transition-colors rounded-lg hover:bg-white/4"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <PanelLeft className="w-4 h-4" />
          ) : (
            <PanelLeftClose className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* ── Scrollable content ── */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-3 space-y-6">
        {/* New workspace + Search */}
        <div className={collapsed ? "flex flex-col items-center" : ""}>
          <Link
            href="/dashboard/workspaces/new"
            className={`
              group relative flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium
              transition-all min-h-10
              ${
                isNavActive("/dashboard/workspaces/new")
                  ? "bg-white/8 text-white"
                  : "text-zinc-300 hover:bg-white/4"
              }
              ${collapsed ? "justify-center w-10" : "w-full"}
            `}
          >
            <IconWrapper>
              <Plus className="w-4 h-4 text-zinc-400 group-hover:text-zinc-200" />
            </IconWrapper>
            {!collapsed && <span>New workspace</span>}
            {collapsed && <Tooltip label="New workspace" />}
          </Link>

          <button
            className={`
              group relative flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium
              text-zinc-300 hover:bg-white/4 transition-all min-h-10
              ${collapsed ? "justify-center w-10" : "w-full"}
            `}
          >
            <IconWrapper>
              <Search className="w-4 h-4 text-zinc-500 group-hover:text-zinc-400" />
            </IconWrapper>
            {!collapsed && <span>Search</span>}
            {collapsed && <Tooltip label="Search" />}
          </button>
        </div>

        {/* All Workspaces */}
        <div className={collapsed ? "flex flex-col items-center" : ""}>
          <Link
            href="/dashboard"
            className={`
              group relative flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium
              transition-all min-h-10
              ${
                pathname === "/dashboard"
                  ? "bg-white/8 text-white"
                  : "text-zinc-300 hover:bg-white/4"
              }
              ${collapsed ? "justify-center w-10" : "w-full"}
            `}
          >
            <IconWrapper active={pathname === "/dashboard"}>
              <FolderKanban className="w-4 h-4 text-zinc-400" />
            </IconWrapper>
            {!collapsed && <span>All Workspaces</span>}
            {collapsed && <Tooltip label="All Workspaces" />}
          </Link>
        </div>

        {/* Workspace nav (when inside a workspace) */}
        {workspaceBase && (
          <div
            className={`pt-4 space-y-0.5 border-t border-white/5 mt-4 ${collapsed ? "px-1" : "px-3"}`}
          >
            {!collapsed && (
              <h3 className="px-3 text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-2">
                Workspace
              </h3>
            )}
            {workspaceNavItems.map(({ href, icon, label }) => (
              <Link
                key={href}
                href={href}
                className={`
                  group relative flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium
                  transition-all min-h-10
                  ${
                    pathname === href
                      ? "bg-white/8 text-white"
                      : "text-zinc-400 hover:bg-white/4 hover:text-zinc-200"
                  }
                  ${collapsed ? "justify-center w-10" : "w-full"}
                `}
              >
                <div className="w-6 h-6 flex items-center justify-center shrink-0">
                  {icon}
                </div>
                {!collapsed && label}
                {collapsed && <Tooltip label={label} />}
              </Link>
            ))}
          </div>
        )}

        {/* Recents */}
        <div className={`pt-2 ${collapsed ? "px-1" : ""}`}>
          {!collapsed && (
            <h3 className="px-3 text-[11px] font-bold text-zinc-600 uppercase tracking-widest mb-3">
              Recents
            </h3>
          )}
          <div className="space-y-0.5">
            {workspaces.slice(0, collapsed ? 4 : 8).map((ws) => (
              <Link
                key={ws.id}
                href={`/dashboard/workspaces/${ws.id}`}
                className={`
                  group relative flex items-center px-3 py-1.5 rounded-lg text-[13.5px]
                  text-zinc-400 hover:bg-white/3 hover:text-zinc-200
                  transition-all min-h-8
                  ${collapsed ? "justify-center w-10 mx-auto" : ""}
                `}
              >
                {!collapsed ? (
                  <span className="truncate">{ws.name}</span>
                ) : (
                  <Tooltip label={ws.name} />
                )}
              </Link>
            ))}
            {workspaces.length === 0 && !collapsed && (
              <p className="px-3 text-[12px] text-zinc-600 italic">
                No recent workspaces
              </p>
            )}
            {collapsed && workspaces.length > 0 && (
              <Tooltip
                label={`${workspaces.length} workspace${workspaces.length !== 1 ? "s" : ""}`}
              />
            )}
          </div>
        </div>
      </div>

      {/* ── User menu ── */}
      <div
        className={`p-3 mt-auto relative ${collapsed ? "flex justify-center" : ""}`}
      >
        <button
          onClick={() => setUserMenuOpen((o) => !o)}
          className={`
            flex items-center gap-3 p-2 rounded-xl border border-transparent
            hover:bg-white/4 transition-all text-left group
            ${collapsed ? "w-10 justify-center" : "w-full"}
          `}
        >
          {user?.avatar_url ? (
            <img
              src={user.avatar_url}
              alt="User Avatar"
              className="w-9 h-9 rounded-full border border-white/10 shrink-0"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-zinc-800 border border-white/10 flex items-center justify-center text-sm font-bold text-zinc-400 shrink-0">
              {user?.full_name?.[0]?.toUpperCase() ||
                user?.email?.[0]?.toUpperCase() ||
                "?"}
            </div>
          )}
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-zinc-100 truncate">
                  {user?.full_name || "User"}
                </p>
                <p className="text-[11px] text-zinc-500 truncate font-medium">
                  Free plan
                </p>
              </div>
              <div className="text-zinc-500 group-hover:text-zinc-300">
                <ChevronsUpDown className="w-4 h-4" />
              </div>
            </>
          )}
          {collapsed && (
            <Tooltip label={user?.full_name || "User"} side="left" />
          )}
        </button>

        <AnimatePresence>
          {userMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setUserMenuOpen(false)}
              />
              <motion.div
                initial={{ opacity: 0, y: 4, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 4, scale: 0.96 }}
                className="absolute bottom-full left-3 right-3 mb-2 bg-[#161617] border border-white/10 rounded-2xl shadow-2xl z-50 py-2 min-w-[220px]"
              >
                <div className="px-4 py-2 mb-1">
                  <p className="text-[12px] text-zinc-500 truncate">
                    {user?.email}
                  </p>
                </div>
                <div className="px-2 space-y-0.5">
                  <Link
                    href="/dashboard/settings"
                    onClick={() => setUserMenuOpen(false)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm text-zinc-300 hover:bg-white/6 hover:text-white transition-all group"
                  >
                    <div className="flex items-center gap-2.5">
                      <Settings className="w-4 h-4 text-zinc-500 group-hover:text-zinc-300" />
                      <span>Settings</span>
                    </div>
                    <span className="text-[10px] text-zinc-600 font-medium">
                      ⌘,
                    </span>
                  </Link>
                  <Link
                    href="/dashboard/billing"
                    onClick={() => setUserMenuOpen(false)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-zinc-300 hover:bg-white/6 hover:text-white transition-all group"
                  >
                    <ArrowUpCircle className="w-4 h-4 text-zinc-500 group-hover:text-zinc-300" />
                    <span>Upgrade plan</span>
                  </Link>
                  <div className="h-px bg-white/5 my-1.5 mx-1" />
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-zinc-400 hover:bg-red-500/10 hover:text-red-400 transition-all group text-left"
                  >
                    <LogOut className="w-4 h-4 text-zinc-500 group-hover:text-red-400" />
                    <span>Log out</span>
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </aside>
  );
}
