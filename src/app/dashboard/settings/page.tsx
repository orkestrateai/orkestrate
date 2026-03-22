"use client";

import { useState, useEffect } from "react";
import {
  User,
  Github,
  Bell,
  Key,
  CheckCircle,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";
import { GitHubReconnectButton } from "@/components/auth/GitHubReconnectButton";
import { Session } from "@supabase/supabase-js";

const SETTINGS_CATEGORIES = [
  { id: "profile", label: "Profile", icon: User },
  { id: "accounts", label: "Connected Accounts", icon: Github },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "api-keys", label: "API Keys", icon: Key },
];

export default function SettingsView() {
  const [activeTab, setActiveTab] = useState("profile");

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
          {activeTab === "profile" && <ProfileSettingsTab />}
          {activeTab === "accounts" && <AccountsSettingsTab />}
          {activeTab === "notifications" && <NotificationsSettingsTab />}
          {activeTab === "api-keys" && <ApiKeysSettingsTab />}
        </div>
      </div>
    </div>
  );
}

function ProfileSettingsTab() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">(
    "idle",
  );

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth
      .getSession()
      .then(({ data: { session } }: { data: { session: Session | null } }) => {
        if (session?.user) {
          setFullName(session.user.user_metadata?.full_name || "");
          setEmail(session.user.email || "");
        }
      });
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveStatus("idle");
    const supabase = createSupabaseBrowserClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    try {
      const res = await fetch("/api/user/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ fullName: fullName.trim() }),
      });

      if (res.ok) {
        setSaveStatus("success");
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
          Profile Settings
        </h2>
        <p className="text-[13px] text-[#8A8F98] mb-6">
          Manage your personal information.
        </p>

        <div className="space-y-5">
          <div className="flex flex-col gap-2">
            <label className="text-[13px] font-medium text-[#D1D3D8]">
              Full Name
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
                setSaveStatus("idle");
              }}
              className="w-full max-w-sm bg-[#16181A] border border-[#232529] rounded-[6px] py-2 px-3 text-[13px] text-[#F2F2F2] focus:outline-none focus:border-[#444853] focus:bg-[#1A1C20] transition-colors"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[13px] font-medium text-[#D1D3D8]">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              disabled
              className="w-full max-w-sm bg-[#16181A] border border-[#232529] rounded-[6px] py-2 px-3 text-[13px] text-[#5E626B] cursor-not-allowed"
            />
            <span className="text-[11px] text-[#5E626B]">
              Email cannot be changed.
            </span>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={isSaving || !fullName.trim()}
            className="bg-[#EBEBEB] text-[#111214] hover:bg-white disabled:opacity-50 text-[13px] font-medium px-4 py-1.5 rounded-[6px] transition-colors flex items-center gap-2"
          >
            {isSaving ? "Saving..." : "Save"}
            {saveStatus === "success" && (
              <CheckCircle className="w-3.5 h-3.5 text-green-600" />
            )}
          </button>
          {saveStatus === "error" && (
            <span className="text-[11px] text-red-400 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              Failed to save
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function AccountsSettingsTab() {
  const [isGitHubConnected, setIsGitHubConnected] = useState(false);
  const [isCheckingConn, setIsCheckingConn] = useState(true);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

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
    } catch (err) {
      console.error("Failed to disconnect GitHub:", err);
    } finally {
      setIsDisconnecting(false);
    }
  };

  return (
    <div className="max-w-xl space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div>
        <h2 className="text-[18px] font-medium text-[#F2F2F2] mb-1">
          Connected Accounts
        </h2>
        <p className="text-[13px] text-[#8A8F98] mb-6">
          Link your external accounts to enable integrations.
        </p>

        <div className="space-y-4">
          {isCheckingConn ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-[#5E626B]" />
            </div>
          ) : (
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
          )}
        </div>
      </div>
    </div>
  );
}

function NotificationsSettingsTab() {
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [agentAlerts, setAgentAlerts] = useState(true);
  const [billingAlerts, setBillingAlerts] = useState(true);

  return (
    <div className="max-w-xl space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div>
        <h2 className="text-[18px] font-medium text-[#F2F2F2] mb-1">
          Notification Preferences
        </h2>
        <p className="text-[13px] text-[#8A8F98] mb-6">
          Choose how you want to be notified.
        </p>

        <div className="space-y-4">
          <label className="flex items-center justify-between p-4 bg-[#16181A] border border-[#232529] rounded-[12px] cursor-pointer hover:bg-[#1A1C20] transition-colors">
            <div>
              <div className="text-[14px] font-medium text-[#F2F2F2]">
                Email Notifications
              </div>
              <div className="text-[12px] text-[#8A8F98] mt-0.5">
                Receive updates via email
              </div>
            </div>
            <input
              type="checkbox"
              checked={emailNotifications}
              onChange={(e) => setEmailNotifications(e.target.checked)}
              className="w-4 h-4 accent-white"
            />
          </label>

          <label className="flex items-center justify-between p-4 bg-[#16181A] border border-[#232529] rounded-[12px] cursor-pointer hover:bg-[#1A1C20] transition-colors">
            <div>
              <div className="text-[14px] font-medium text-[#F2F2F2]">
                Agent Alerts
              </div>
              <div className="text-[12px] text-[#8A8F98] mt-0.5">
                Get notified when agents need attention
              </div>
            </div>
            <input
              type="checkbox"
              checked={agentAlerts}
              onChange={(e) => setAgentAlerts(e.target.checked)}
              className="w-4 h-4 accent-white"
            />
          </label>

          <label className="flex items-center justify-between p-4 bg-[#16181A] border border-[#232529] rounded-[12px] cursor-pointer hover:bg-[#1A1C20] transition-colors">
            <div>
              <div className="text-[14px] font-medium text-[#F2F2F2]">
                Billing Alerts
              </div>
              <div className="text-[12px] text-[#8A8F98] mt-0.5">
                Notifications about plan usage and invoices
              </div>
            </div>
            <input
              type="checkbox"
              checked={billingAlerts}
              onChange={(e) => setBillingAlerts(e.target.checked)}
              className="w-4 h-4 accent-white"
            />
          </label>
        </div>
      </div>
    </div>
  );
}

function ApiKeysSettingsTab() {
  return (
    <div className="max-w-xl space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div>
        <h2 className="text-[18px] font-medium text-[#F2F2F2] mb-1">
          API Keys
        </h2>
        <p className="text-[13px] text-[#8A8F98] mb-6">
          Manage your API keys for programmatic access.
        </p>

        <div className="bg-[#16181A] border border-[#232529] rounded-[12px] p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-[14px] font-medium text-[#F2F2F2]">
                Personal API Key
              </div>
              <div className="text-[12px] text-[#8A8F98] mt-0.5">
                For server-to-server authentication
              </div>
            </div>
            <button
              disabled
              className="px-4 py-1.5 rounded-[6px] text-[13px] font-medium bg-[#232529] text-[#5E626B] cursor-not-allowed"
            >
              Coming soon
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
