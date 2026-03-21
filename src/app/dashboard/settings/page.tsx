"use client";

import { useState, useEffect } from "react";
import {
  Briefcase,
  GitBranch,
  CheckCircle,
  AlertCircle,
  Github,
  Lock,
  ChevronDown,
  Loader2,
  CreditCard,
} from "lucide-react";
import useSWR from "swr";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";
import { GitHubReconnectButton } from "@/components/auth/GitHubReconnectButton";

const SETTINGS_CATEGORIES = [
  { id: "general", label: "General", icon: Briefcase },
  { id: "git", label: "Git", icon: GitBranch },
  { id: "billing", label: "Billing", icon: CreditCard },
];

import { Session } from "@supabase/supabase-js";

const settingsFetcher = (url: string) => {
  const supabase = createSupabaseBrowserClient();
  return supabase.auth
    .getSession()
    .then(({ data: { session } }: { data: { session: Session | null } }) => {
      return fetch(url, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      }).then((res) => res.json());
    });
};

export default function SettingsView() {
  const [activeTab, setActiveTab] = useState("general");
  const { data: wsData, mutate: mutateWorkspaces } = useSWR(
    "/api/workspaces",
    settingsFetcher,
  );

  const workspaces = Array.isArray(wsData?.workspaces) ? wsData.workspaces : [];
  const activeWorkspace =
    workspaces.find((w: any) => w.isActive) || workspaces[0];

  return (
    <div className="h-full w-full bg-[#0A0A0B] text-[#EBEBEB] font-sans">
      <div className="w-full max-w-5xl mx-auto h-full flex pt-12 px-8">
        {/* Left navigation sidebar */}
        <div className="w-64 pr-12 shrink-0 border-r border-white/5 h-fit pb-8">
          <h1 className="text-[24px] font-bold tracking-tight text-white mb-8 pl-1">
            Settings
          </h1>
          <nav className="space-y-1">
            {SETTINGS_CATEGORIES.map((category) => {
              const isActive = activeTab === category.id;
              return (
                <button
                  key={category.id}
                  onClick={() => setActiveTab(category.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-[6px] text-[13px] font-medium transition-colors ${
                    isActive
                      ? "bg-[#1A1C20] text-[#EBEBEB] border border-[#232529] shadow-inner"
                      : "text-[#8A8F98] hover:bg-[#16181A] hover:text-[#D1D3D8] border border-transparent"
                  }`}
                >
                  <category.icon
                    className={`w-4 h-4 ${isActive ? "text-[#EBEBEB]" : "text-[#5E626B]"}`}
                  />
                  {category.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto pb-24 px-4">
          {/* General Settings Content */}
          {activeTab === "general" && (
            <GeneralSettingsTab
              activeWorkspace={activeWorkspace}
              mutateWorkspaces={mutateWorkspaces}
            />
          )}

          {/* Git Settings Content */}
          {activeTab === "git" && (
            <GitSettingsTab
              activeWorkspace={activeWorkspace}
              mutateWorkspaces={mutateWorkspaces}
            />
          )}

          {/* Billing Settings Content */}
          {activeTab === "billing" && <BillingSettingsTab />}
        </div>
      </div>
    </div>
  );
}

function BillingSettingsTab() {
  const { data: subData } = useSWR("/api/payments/status", settingsFetcher);
  const planType = subData?.planType || "hobby";
  const limits = subData?.limits || { maxAgents: 3, maxMembers: 1 };

  return (
    <div className="max-w-xl space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div>
        <h2 className="text-[18px] font-medium text-[#F2F2F2] mb-1">
          Billing & Plans
        </h2>
        <p className="text-[13px] text-[#8A8F98] mb-6">
          Manage your subscription and view usage limits.
        </p>

        <div className="bg-[#16181A] border border-[#232529] rounded-[8px] p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[11px] text-[#5E626B] uppercase font-bold tracking-wider mb-1">
                Current Plan
              </div>
              <div className="text-[16px] font-medium text-white capitalize">
                {planType}
              </div>
            </div>
            <Link
              href="/dashboard/billing"
              className="bg-[#1A1C20] hover:bg-[#232529] text-white border border-[#232529] text-[13px] font-medium px-4 py-1.5 rounded-[6px] transition-colors"
            >
              Change Plan
            </Link>
          </div>

          <div className="h-[1px] w-full bg-[#232529]"></div>

          <div className="space-y-4">
            <div className="flex justify-between items-center text-[13px]">
              <span className="text-[#8A8F98]">Agents</span>
              <span className="text-white font-medium">
                {limits.maxAgents >= 999 ? "Unlimited" : limits.maxAgents}
              </span>
            </div>
            <div className="flex justify-between items-center text-[13px]">
              <span className="text-[#8A8F98]">Members</span>
              <span className="text-white font-medium">
                {limits.maxMembers >= 999 ? "Unlimited" : limits.maxMembers}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-[14px] font-medium text-[#F2F2F2] mb-1">
          Payment History
        </h3>
        <p className="text-[13px] text-[#8A8F98] mb-4">
          View your past invoices and receipts.
        </p>
        <button
          disabled
          className="text-[#5E626B] text-[13px] flex items-center gap-2 cursor-not-allowed"
        >
          No payment history available
        </button>
      </div>
    </div>
  );
}

import Link from "next/link";

function GeneralSettingsTab({
  activeWorkspace,
  mutateWorkspaces,
}: {
  activeWorkspace: any;
  mutateWorkspaces: any;
}) {
  const [name, setName] = useState(activeWorkspace?.name || "");
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">(
    "idle",
  );
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    setName(activeWorkspace?.name || "");
  }, [activeWorkspace?.name]);

  const handleSave = async () => {
    if (!activeWorkspace?.id) return;
    setIsSaving(true);
    setSaveStatus("idle");
    const supabase = createSupabaseBrowserClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    try {
      const res = await fetch(`/api/workspaces`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          action: "rename",
          workspaceId: activeWorkspace.id,
          name: name.trim(),
        }),
      });
      if (res.ok) {
        setSaveStatus("success");
        await mutateWorkspaces();
        setTimeout(() => setSaveStatus("idle"), 3000);
      } else {
        setSaveStatus("error");
      }
    } catch {
      setSaveStatus("error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!activeWorkspace?.id) return;
    setIsSaving(true);
    const supabase = createSupabaseBrowserClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    try {
      const res = await fetch(`/api/workspaces`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          action: "delete",
          workspaceId: activeWorkspace.id,
        }),
      });
      if (res.ok) {
        window.location.href = "/dashboard";
      } else {
        setSaveStatus("error");
      }
    } catch {
      setSaveStatus("error");
    } finally {
      setIsSaving(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div className="max-w-xl space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div>
        <h2 className="text-[18px] font-medium text-[#F2F2F2] mb-1">
          Workspace settings
        </h2>
        <p className="text-[13px] text-[#8A8F98] mb-6">
          Manage your workspace details and preferences.
        </p>

        <div className="space-y-5">
          <div className="flex flex-col gap-2">
            <label className="text-[13px] font-medium text-[#D1D3D8]">
              Workspace Name
            </label>
            <div className="flex gap-2 items-center">
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setSaveStatus("idle");
                }}
                className="flex-1 bg-[#16181A] border border-[#232529] rounded-[6px] py-2 px-3 text-[13px] text-[#F2F2F2] focus:outline-none focus:border-[#444853] focus:bg-[#1A1C20] transition-colors"
              />
              <button
                onClick={handleSave}
                disabled={
                  isSaving || !name.trim() || name === activeWorkspace?.name
                }
                className="bg-[#EBEBEB] text-[#111214] hover:bg-white disabled:opacity-50 text-[13px] font-medium px-4 py-1.5 rounded-[6px] transition-colors flex items-center gap-2"
              >
                {isSaving ? "Saving..." : "Save"}
                {saveStatus === "success" && (
                  <CheckCircle className="w-3.5 h-3.5 text-green-600" />
                )}
              </button>
            </div>
            {saveStatus === "error" && (
              <span className="text-[11px] text-red-400 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Failed to save
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="h-[1px] w-full bg-[#16181A] border-t border-[#232529]"></div>

      <div>
        <h3 className="text-[14px] font-medium text-[#F2F2F2] mb-1">
          Delete Workspace
        </h3>
        <p className="text-[13px] text-[#8A8F98] mb-4 text-balance">
          Permanently remove your workspace and all of its contents. This action
          is not reversible.
        </p>
        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            disabled={activeWorkspace?.isActive}
            className="bg-[#1A1C20] hover:bg-[#232529] text-zinc-400 hover:text-white border border-[#232529] disabled:opacity-30 disabled:cursor-not-allowed text-[13px] font-medium px-4 py-1.5 rounded-[6px] transition-colors"
          >
            Delete Workspace...
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-[13px] text-red-400">Are you sure?</span>
            <button
              onClick={handleDelete}
              disabled={isSaving}
              className="bg-red-600 hover:bg-red-700 text-white text-[13px] font-medium px-3 py-1.5 rounded-[6px] transition-colors disabled:opacity-50"
            >
              {isSaving ? "Deleting..." : "Confirm"}
            </button>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="text-[13px] text-zinc-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
        {activeWorkspace?.isActive && (
          <p className="text-[11px] text-[#5E626B] mt-2">
            Cannot delete an active workspace.
          </p>
        )}
      </div>
    </div>
  );
}

function GitSettingsTab({
  activeWorkspace,
  mutateWorkspaces,
}: {
  activeWorkspace: any;
  mutateWorkspaces: any;
}) {
  const [repoUrl, setRepoUrl] = useState(activeWorkspace?.repoUrl || "");
  const [defaultBranch, setDefaultBranch] = useState(
    activeWorkspace?.defaultBranch || "main",
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">(
    "idle",
  );
  const [isGitHubConnected, setIsGitHubConnected] = useState(false);
  const [isCheckingConn, setIsCheckingConn] = useState(true);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [userRepos, setUserRepos] = useState<any[]>([]);
  const [isLoadingRepos, setIsLoadingRepos] = useState(false);
  const [isBrowsingRepos, setIsBrowsingRepos] = useState(false);
  const [availableBranches, setAvailableBranches] = useState<any[]>([]);
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);

  // Poll GitHub connection status from the backend
  useEffect(() => {
    const checkConn = async () => {
      setIsCheckingConn(true);
      try {
        const supabase = createSupabaseBrowserClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.access_token) {
          setIsGitHubConnected(false);
          return;
        }

        const res = await fetch("/api/github/status", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (res.ok) {
          const data = await res.json();
          setIsGitHubConnected(data.connected ?? false);
        } else {
          setIsGitHubConnected(false);
        }
      } catch {
        setIsGitHubConnected(false);
      } finally {
        setIsCheckingConn(false);
      }
    };

    const urlParams = new URLSearchParams(window.location.search);

    // If returning from GitHub OAuth, sync the token first then check connection
    if (urlParams.has("code")) {
      (async () => {
        try {
          await fetch("/api/github/sync-token", { method: "POST" });
        } catch (err) {
          console.error("Failed to sync GitHub token:", err);
        }
        await checkConn();
        window.history.replaceState({}, "", window.location.pathname);
      })();
    } else {
      checkConn();
    }

    const supabase = createSupabaseBrowserClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      checkConn();
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    setRepoUrl(activeWorkspace?.repoUrl || "");
    setDefaultBranch(activeWorkspace?.defaultBranch || "main");
  }, [activeWorkspace?.repoUrl, activeWorkspace?.defaultBranch]);

  const handleDisconnectGitHub = async () => {
    setIsDisconnecting(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      await fetch("/api/github/token", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      setIsGitHubConnected(false);
      setUserRepos([]);
      setAvailableBranches([]);
      setIsBrowsingRepos(false);
    } catch (err) {
      console.error("Failed to disconnect GitHub:", err);
    } finally {
      setIsDisconnecting(false);
    }
  };

  const fetchRepos = async () => {
    setIsLoadingRepos(true);
    setSaveStatus("idle");
    try {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const res = await fetch("/api/git/repos", {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });

      if (res.status === 401) {
        setSaveStatus("error");
        throw new Error(
          "GitHub connection required. Please connect GitHub in settings.",
        );
      }

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to fetch repositories.");
      }

      const data = await res.json();
      setUserRepos(data.repos || []);
      setIsBrowsingRepos(true);
    } catch (error) {
      setSaveStatus("error");
      console.error(error);
    } finally {
      setIsLoadingRepos(false);
    }
  };

  const fetchBranches = async (url: string) => {
    setIsLoadingBranches(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const match = url.match(/github\.com\/([^/]+)\/([^/.]+)/);
      if (!match) return;
      const [_, owner, repo] = match;

      const res = await fetch(`/api/git/branches?owner=${owner}&repo=${repo}`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });

      if (res.status === 401) {
        throw new Error(
          "GitHub connection required. Please connect GitHub in settings.",
        );
      }

      if (res.ok) {
        const data = await res.json();
        setAvailableBranches(data.branches || []);
      }
    } catch (error) {
      console.error("Failed to fetch branches:", error);
    } finally {
      setIsLoadingBranches(false);
    }
  };

  const handleSave = async () => {
    if (!activeWorkspace?.id) return;
    setIsSaving(true);
    setSaveStatus("idle");

    const supabase = createSupabaseBrowserClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    try {
      const res = await fetch(`/api/workspaces`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          action: "bind-repo",
          workspaceId: activeWorkspace.id,
          repoUrl: repoUrl.trim() || null,
          defaultBranch: defaultBranch.trim() || "main",
        }),
      });

      if (res.ok) {
        setSaveStatus("success");
        await mutateWorkspaces();
        setTimeout(() => setSaveStatus("idle"), 3000);
      } else {
        setSaveStatus("error");
      }
    } catch {
      setSaveStatus("error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-xl space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div>
        <h2 className="text-[18px] font-medium text-[#F2F2F2] mb-1">
          Git Repository Binding
        </h2>
        <p className="text-[13px] text-[#8A8F98] mb-6">
          Bind this workspace to a Git repository for Git-Rooted Coordination.
        </p>

        <div className="space-y-6">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between px-1">
              <label className="text-[13px] font-medium text-[#D1D3D8]">
                Repository URL
              </label>
              {isGitHubConnected && !isBrowsingRepos && (
                <button
                  onClick={() => void fetchRepos()}
                  disabled={isLoadingRepos}
                  className="text-[11px] text-zinc-400 hover:text-white flex items-center gap-1 disabled:opacity-50 transition-colors"
                >
                  {isLoadingRepos ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Github className="w-3 h-3" />
                  )}
                  Browse Repos
                </button>
              )}
            </div>

            {isBrowsingRepos ? (
              <div className="bg-[#16181A] border border-[#232529] rounded-[8px] max-h-[200px] overflow-y-auto shadow-2xl ring-1 ring-white/5 animate-in fade-in zoom-in-95 duration-200">
                {userRepos.length > 0 ? (
                  userRepos.map((repo) => (
                    <button
                      key={repo.full_name}
                      onClick={() => {
                        setRepoUrl(repo.url);
                        setDefaultBranch(repo.default_branch || "main");
                        setIsBrowsingRepos(false);
                        setSaveStatus("idle");
                        void fetchBranches(repo.url);
                      }}
                      className="w-full text-left px-4 py-3 border-b border-[#232529] last:border-0 hover:bg-white/[0.04] transition-colors group"
                    >
                      <div className="text-[13px] text-[#F2F2F2] font-medium group-hover:text-white truncate">
                        {repo.full_name}
                      </div>
                      {repo.description && (
                        <div className="text-[11px] text-[#5E626B] truncate mt-0.5">
                          {repo.description}
                        </div>
                      )}
                    </button>
                  ))
                ) : (
                  <div className="px-4 py-6 text-center text-[13px] text-[#5E626B]">
                    No repositories found.
                  </div>
                )}
                <button
                  onClick={() => setIsBrowsingRepos(false)}
                  className="w-full py-2.5 text-[12px] text-[#5E626B] hover:text-[#D1D3D8] hover:bg-white/[0.04] border-t border-[#232529]"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="relative group/input">
                <input
                  type="text"
                  value={repoUrl}
                  onChange={(e) => {
                    setRepoUrl(e.target.value);
                    setSaveStatus("idle");
                  }}
                  placeholder={
                    isGitHubConnected
                      ? "https://github.com/owner/repo"
                      : "Connect GitHub to browse repositories"
                  }
                  className="w-full bg-[#16181A] border border-[#232529] rounded-[6px] py-2.5 pl-4 pr-10 text-[13px] text-[#F2F2F2] placeholder:text-[#5E626B] focus:outline-none focus:border-[#444853] focus:bg-[#1A1C20] transition-colors font-mono"
                />
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#3A3F4A]">
                  {repoUrl ? (
                    <a
                      href={repoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-white transition-colors"
                      onClick={(e) => {
                        if (!repoUrl) e.preventDefault();
                      }}
                    >
                      <Github className="w-3.5 h-3.5" />
                    </a>
                  ) : (
                    <Lock className="w-3.5 h-3.5" />
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[13px] font-medium text-[#D1D3D8]">
              Default Branch
            </label>
            <div className="relative group/input w-48">
              <select
                value={defaultBranch}
                onChange={(e) => {
                  setDefaultBranch(e.target.value);
                  setSaveStatus("idle");
                }}
                disabled={isLoadingBranches || !repoUrl}
                className="w-full bg-[#16181A] border border-[#232529] rounded-[6px] py-2 px-3 text-[13px] text-[#F2F2F2] placeholder:text-[#5E626B] focus:outline-none focus:border-[#444853] focus:bg-[#1A1C20] transition-all appearance-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
              >
                {!repoUrl && <option value="">Select repo first</option>}
                {isLoadingBranches ? (
                  <option>Loading branches...</option>
                ) : availableBranches.length > 0 ? (
                  availableBranches.map((b) => (
                    <option
                      key={b.name}
                      value={b.name}
                      className="bg-[#16181A]"
                    >
                      {b.name}
                    </option>
                  ))
                ) : (
                  repoUrl && <option>{defaultBranch}</option>
                )}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#5E626B]">
                {isLoadingBranches ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-white hover:bg-zinc-200 disabled:opacity-50 text-black px-4 py-2 rounded-[6px] text-[13px] font-medium transition-colors flex items-center gap-2"
          >
            {isSaving ? "Saving..." : "Save Changes"}
            {saveStatus === "success" && (
              <CheckCircle className="w-4 h-4 text-black" />
            )}
          </button>
          {saveStatus === "error" && (
            <span className="text-[13px] text-zinc-400 flex items-center gap-1">
              <AlertCircle className="w-4 h-4" />
              Failed to save
            </span>
          )}
        </div>
      </div>

      <div className="h-[1px] w-full bg-[#16181A] border-t border-[#232529]"></div>

      <div>
        <h2 className="text-[18px] font-medium text-[#F2F2F2] mb-1">
          GitHub Account
        </h2>
        <p className="text-[13px] text-[#8A8F98] mb-6">
          Connect your GitHub account to enable repository browsing and agent
          integration.
        </p>

        <div className="flex items-center justify-between p-4 bg-[#16181A] border border-[#232529] rounded-[12px]">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
              <Github className="w-5 h-5 text-[#F2F2F2]" />
            </div>
            <div>
              <div className="text-[14px] font-medium text-[#F2F2F2]">
                GitHub
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div
                  className={`w-1.5 h-1.5 rounded-full ${isGitHubConnected ? "bg-white shadow-[0_0_8px_rgba(255,255,255,0.5)]" : "bg-[#3A3F4A]"}`}
                ></div>
                <span className="text-[12px] text-[#8A8F98]">
                  {isGitHubConnected ? "Connected" : "Not connected"}
                </span>
              </div>
            </div>
          </div>
          {isGitHubConnected ? (
            <button
              onClick={() => void handleDisconnectGitHub()}
              disabled={isDisconnecting}
              className="px-4 py-1.5 rounded-[6px] text-[13px] font-medium bg-transparent border border-[#232529] text-[#F2F2F2] hover:bg-white/5 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isDisconnecting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Github className="w-3.5 h-3.5" />
              )}
              Disconnect
            </button>
          ) : (
            <GitHubReconnectButton
              label="Connect"
              className="px-4 py-1.5 rounded-[6px] text-[13px] font-medium bg-[#F2F2F2] text-[#111214] hover:bg-white transition-colors"
            />
          )}
        </div>
      </div>
    </div>
  );
}
