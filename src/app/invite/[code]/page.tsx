"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, Users, ArrowRight } from "lucide-react";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";

type InvitePreview = {
  code: string;
  workspaceId: string;
  workspaceName: string;
  role: "member" | "admin";
  repoUrl: string | null;
  remainingUses: number | null;
  expiresAt: string | null;
};

export default function InviteAcceptPage() {
  const router = useRouter();
  const params = useParams<{ code: string }>();
  const rawCode = params.code;
  const code = Array.isArray(rawCode) ? rawCode[0] : rawCode;

  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code || typeof code !== "string") {
      setLoading(false);
      setError("Invite code is missing.");
      return;
    }

    const loadInvite = async () => {
      setError(null);
      try {
        const response = await fetch(
          `/api/workspaces/invite?code=${encodeURIComponent(code)}`,
          { cache: "no-store" },
        );
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          setError(payload.error || "Invite is invalid or expired.");
          return;
        }
        setPreview(payload as InvitePreview);
      } catch {
        setError("Failed to load invite.");
      } finally {
        setLoading(false);
      }
    };

    void loadInvite();
  }, [code]);

  const acceptInvite = async () => {
    if (!code || typeof code !== "string") {
      setError("Invite code is missing.");
      return;
    }

    setAccepting(true);
    setError(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        router.push(`/login?next=${encodeURIComponent(`/invite/${code}`)}`);
        return;
      }

      const response = await fetch("/api/workspaces/invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action: "accept", code }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(payload.error || "Failed to accept invite.");
        return;
      }

      const workspaceId = payload.workspaceId || preview?.workspaceId;
      if (workspaceId) {
        router.push(`/dashboard/workspaces/${workspaceId}`);
        return;
      }
      router.push("/dashboard");
    } catch {
      setError("Failed to accept invite.");
    } finally {
      setAccepting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#050505] text-[#F2F2F2] px-6 py-12 flex items-center justify-center">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0E0F10] p-8 shadow-[0_25px_70px_rgba(0,0,0,0.55)]">
        {loading ? (
          <div className="flex h-36 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
          </div>
        ) : error ? (
          <div className="space-y-4">
            <h1 className="text-xl font-semibold text-white">Invite unavailable</h1>
            <p className="text-sm text-zinc-400">{error}</p>
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="inline-flex h-10 items-center rounded-lg border border-white/10 bg-white/[0.05] px-4 text-sm text-zinc-200 hover:bg-white/[0.09]"
            >
              Go to dashboard
            </button>
          </div>
        ) : preview ? (
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-zinc-300">
                <Users className="h-3.5 w-3.5" />
                Workspace Invite
              </div>
              <h1 className="text-2xl font-semibold text-white">
                Join {preview.workspaceName}
              </h1>
              <p className="text-sm text-zinc-400">
                You were invited as a {preview.role}. Accept to access the shared
                workspace and agent state.
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/25 p-4 text-sm text-zinc-300">
              <div className="mb-1 text-xs uppercase tracking-[0.12em] text-zinc-500">
                Repository
              </div>
              <div className="font-mono text-xs break-all text-zinc-300">
                {preview.repoUrl || "No repository bound"}
              </div>
            </div>

            <button
              type="button"
              onClick={acceptInvite}
              disabled={accepting}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#6C6DEB] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#7677F5] disabled:opacity-60"
            >
              {accepting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              {accepting ? "Joining workspace..." : "Accept invite"}
            </button>

            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="inline-flex h-10 w-full items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] px-4 text-sm text-zinc-200 hover:bg-white/[0.09]"
            >
              Maybe later
            </button>
          </div>
        ) : null}
      </div>
    </main>
  );
}
