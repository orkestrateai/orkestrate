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
  Trash2,
} from "lucide-react";
import useSWR from "swr";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";
import { GitHubReconnectButton } from "@/components/auth/GitHubReconnectButton";
import { Session } from "@supabase/supabase-js";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useGitHubConnection } from "@/hooks/useGitHubConnection";

const SETTINGS_CATEGORIES = [
  { id: "general", label: "General", icon: Briefcase },
  { id: "git", label: "Git", icon: GitBranch },
];

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

export default function WorkspaceSettingsPage() {
  const { id } = useParams();
  const [activeTab, setActiveTab] = useState("general");
  const { data: wsData, mutate: mutateWorkspaces } = useSWR(
    "/api/workspaces",
    settingsFetcher,
  );

  const workspaces = Array.isArray(wsData?.workspaces) ? wsData.workspaces : [];
  const workspace = workspaces.find((w: any) => w.id === id);

  if (!workspace && !wsData) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#050505] min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-700 mb-4" />
        <span className="text-zinc-500 font-medium">Loading...</span>
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#050505] min-h-screen p-8 text-center">
        <h1 className="text-xl font-bold text-white mb-2">
          Workspace not found
        </h1>
        <Link
          href="/dashboard"
          className="text-sm hover:text-white transition-colors text-zinc-400"
        >
          Return to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-[#0A0A0B] text-[#EBEBEB] font-sans">
      <div className="w-full max-w-5xl mx-auto h-full flex pt-12 px-8">
        {/* Left navigation sidebar */}
        <div className="w-64 pr-12 shrink-0 border-r border-white/5 h-fit pb-8">
          <div className="flex items-center gap-2 text-zinc-500 mb-6 hover:text-white transition-colors w-fit">
            <Link
              href={`/dashboard/workspaces/${id}`}
              className="flex items-center gap-1 text-sm"
            >
              ← Back to workspace
            </Link>
          </div>
          <h1 className="text-[24px] font-bold tracking-tight text-white mb-2 pl-1">
            Workspace Settings
          </h1>
          <p className="text-[13px] text-zinc-500 mb-8 pl-1 truncate">
            {workspace.name}
          </p>
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
          {activeTab === "general" && (
            <GeneralSettingsTab
              workspace={workspace}
              mutateWorkspaces={mutateWorkspaces}
            />
          )}
          {activeTab === "git" && (
            <GitSettingsTab
              workspace={workspace}
              mutateWorkspaces={mutateWorkspaces}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function GeneralSettingsTab({
  workspace,
  mutateWorkspaces,
}: {
  workspace: any;
  mutateWorkspaces: any;
}) {
  const router = useRouter();
  const [name, setName] = useState(workspace?.name ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">(
    "idle",
  );
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    setName(workspace?.name ?? "");
  }, [workspace?.name]);

  const handleSave = async () => {
    if (!name.trim() || name.trim() === workspace?.name) return;
    setIsSaving(true);
    setSaveStatus("idle");
    try {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          action: "rename",
          workspaceId: workspace.id,
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
    try {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          action: "delete",
          workspaceId: workspace.id,
        }),
      });

      if (res.ok) {
        router.push("/dashboard");
      }
    } catch {
      // silently fail — user stays on page
    }
  };

  return (
    <div className="max-w-xl space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Rename */}
      <div>
        <h2 className="text-[18px] font-medium text-[#F2F2F2] mb-1">
          Workspace Name
        </h2>
        <p className="text-[13px] text-[#8A8F98] mb-6">
          Update the display name for this workspace.
        </p>
        <div className="flex flex-col gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setSaveStatus("idle");
            }}
            placeholder="Workspace name"
            className="w-full bg-[#16181A] border border-[#232529] rounded-[6px] py-2.5 px-4 text-[13px] text-[#F2F2F2] placeholder:text-[#5E626B] focus:outline-none focus:border-[#444853] focus:bg-[#1A1C20] transition-colors"
          />
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={
              isSaving || !name.trim() || name.trim() === workspace?.name
            }
            className="bg-white hover:bg-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed text-black px-4 py-2 rounded-[6px] text-[13px] font-medium transition-colors flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                Save Changes
                {saveStatus === "success" && (
                  <CheckCircle className="w-4 h-4 text-black" />
                )}
              </>
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

      <div className="h-[1px] w-full bg-[#16181A] border-t border-[#232529]" />

      {/* Delete */}
      <div>
        <h2 className="text-[18px] font-medium text-red-400 mb-1">
          Delete Workspace
        </h2>
        <p className="text-[13px] text-[#8A8F98] mb-6">
          Permanently delete this workspace and all associated data. This action
          cannot be undone.
        </p>

        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-[6px] text-[13px] font-medium border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Delete Workspace
          </button>
        ) : (
          <div className="p-4 bg-red-500/5 border border-red-500/15 rounded-[8px] space-y-3">
            <p className="text-[13px] text-red-300 font-medium">
              Are you sure? This cannot be undone.
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={handleDelete}
                className="px-4 py-1.5 rounded-[6px] text-[13px] font-medium bg-red-500 hover:bg-red-400 text-white transition-colors"
              >
                Yes, delete it
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-1.5 rounded-[6px] text-[13px] font-medium text-[#8A8F98] hover:text-[#D1D3D8] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function GitSettingsTab({
  workspace,
  mutateWorkspaces,
}: {
  workspace: any;
  mutateWorkspaces: any;
}) {
  const [repoUrl, setRepoUrl] = useState(workspace?.repoUrl ?? "");
  const [baseBranch, setBaseBranch] = useState(workspace?.baseBranch ?? "main");
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">(
    "idle",
  );

  const {
    isConnected,
    isChecking,
    isDisconnecting,
    disconnect,
    repos,
    isLoadingRepos,
    isBrowsingRepos,
    setIsBrowsingRepos,
    fetchRepos,
    branches,
    isLoadingBranches,
    fetchBranches,
  } = useGitHubConnection();

  // Sync local state if workspace prop updates (e.g. after SWR revalidation)
  useEffect(() => {
    setRepoUrl(workspace?.repoUrl ?? "");
    setBaseBranch(workspace?.baseBranch ?? "main");
  }, [workspace?.repoUrl, workspace?.baseBranch]);

  const handleBrowseRepos = async () => {
    setSaveStatus("idle");
    try {
      await fetchRepos();
    } catch (err) {
      console.error(err);
      setSaveStatus("error");
    }
  };

  const handleSave = async () => {
    if (!workspace?.id) return;
    setIsSaving(true);
    setSaveStatus("idle");

    try {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          action: "bind-repo",
          workspaceId: workspace.id,
          repoUrl: repoUrl.trim() || null,
          baseBranch: baseBranch.trim() || "main",
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
      {/* Repo Binding */}
      <div>
        <h2 className="text-[18px] font-medium text-[#F2F2F2] mb-1">
          Git Repository Binding
        </h2>
        <p className="text-[13px] text-[#8A8F98] mb-6">
          Bind this workspace to a Git repository for Git-Rooted Coordination.
        </p>

        <div className="space-y-6">
          {/* Workspace Branch (read-only) */}
          {workspace.defaultBranch && (
            <div className="flex flex-col gap-1">
              <span className="text-[13px] font-medium text-[#D1D3D8]">
                Workspace Branch
              </span>
              <div className="flex items-center gap-2 py-2.5 px-4 bg-[#16181A] border border-[#232529] rounded-[6px]">
                <GitBranch className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                <code className="text-[13px] text-emerald-400 font-mono flex-1">
                  {workspace.defaultBranch}
                </code>
                <span className="text-[11px] text-zinc-600">auto-created</span>
              </div>
              <p className="text-[11px] text-zinc-600 px-1">
                Orkestrate&apos;s dedicated branch for this workspace. Agents
                commit here.
              </p>
            </div>
          )}
          {/* Repository URL */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between px-1">
              <label className="text-[13px] font-medium text-[#D1D3D8]">
                Repository URL
              </label>
              {isConnected && !isBrowsingRepos && (
                <button
                  onClick={() => void handleBrowseRepos()}
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
                {repos.length > 0 ? (
                  repos.map((repo) => (
                    <button
                      key={repo.full_name}
                      onClick={() => {
                        setRepoUrl(repo.url);
                        setBaseBranch(repo.default_branch ?? "main");
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
              <div className="relative">
                <input
                  type="text"
                  value={repoUrl}
                  onChange={(e) => {
                    setRepoUrl(e.target.value);
                    setSaveStatus("idle");
                  }}
                  placeholder={
                    isConnected
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

          {/* Base Branch */}
          <div className="flex flex-col gap-2">
            <label className="text-[13px] font-medium text-[#D1D3D8]">
              Base Branch
            </label>
            <div className="relative w-48">
              <select
                value={baseBranch}
                onChange={(e) => {
                  setBaseBranch(e.target.value);
                  setSaveStatus("idle");
                }}
                disabled={isLoadingBranches || !repoUrl}
                className="w-full bg-[#16181A] border border-[#232529] rounded-[6px] py-2 px-3 text-[13px] text-[#F2F2F2] focus:outline-none focus:border-[#444853] focus:bg-[#1A1C20] transition-all appearance-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
              >
                {!repoUrl && <option value="">Select repo first</option>}
                {isLoadingBranches ? (
                  <option>Loading branches...</option>
                ) : branches.length > 0 ? (
                  branches.map((b) => (
                    <option
                      key={b.name}
                      value={b.name}
                      className="bg-[#16181A]"
                    >
                      {b.name}
                    </option>
                  ))
                ) : (
                  repoUrl && <option>{baseBranch}</option>
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

        {/* Save */}
        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-white hover:bg-zinc-200 disabled:opacity-50 text-black px-4 py-2 rounded-[6px] text-[13px] font-medium transition-colors flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                Save Changes
                {saveStatus === "success" && (
                  <CheckCircle className="w-4 h-4 text-black" />
                )}
              </>
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

      <div className="h-[1px] w-full bg-[#16181A] border-t border-[#232529]" />

      {/* GitHub Account */}
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
                    className={`w-1.5 h-1.5 rounded-full ${
                      isChecking
                        ? "bg-[#5E626B] animate-pulse"
                        : isConnected
                          ? "bg-white shadow-[0_0_8px_rgba(255,255,255,0.5)]"
                          : "bg-[#3A3F4A]"
                    }`}
                  />
                  <span className="text-[12px] text-[#8A8F98]">
                    {isChecking
                      ? "Checking..."
                      : isConnected
                        ? "Connected"
                        : "Not connected"}
                  </span>
                </div>
              </div>
            </div>

            {isChecking ? (
              <div className="px-4 py-1.5 rounded-[6px] text-[13px] font-medium bg-transparent border border-[#232529] text-[#5E626B] flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Checking...
              </div>
            ) : isConnected ? (
              <button
                onClick={() => void disconnect()}
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
