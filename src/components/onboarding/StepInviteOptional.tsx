"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, Loader2, Plus } from "lucide-react";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";

type InviteRecord = {
  id: string;
  code: string;
  url: string;
  role: string;
  usedCount: number;
  expiresAt: string | null;
};

type StepInviteOptionalProps = {
  workspaceId: string | null;
  inviteCount: number;
  onInviteUpdated: () => Promise<void> | void;
  onContinue: () => void;
};

export function StepInviteOptional({
  workspaceId,
  inviteCount,
  onInviteUpdated,
  onContinue,
}: StepInviteOptionalProps) {
  const [invites, setInvites] = useState<InviteRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<string | null>(null);

  const hasInvites = inviteCount > 0 || invites.length > 0;

  const latestInvite = useMemo(() => {
    if (invites.length === 0) return null;
    return invites[0];
  }, [invites]);

  useEffect(() => {
    const loadInvites = async () => {
      if (!workspaceId) {
        setInvites([]);
        setLoading(false);
        return;
      }
      try {
        const supabase = createSupabaseBrowserClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) return;
        const response = await fetch(
          `/api/workspaces/invite?workspaceId=${encodeURIComponent(workspaceId)}`,
          { headers: { Authorization: `Bearer ${session.access_token}` } },
        );
        const payload = await response.json().catch(() => ({}));
        if (response.ok) {
          setInvites(Array.isArray(payload.invites) ? payload.invites : []);
        }
      } catch {
        setError("Failed to load invites.");
      } finally {
        setLoading(false);
      }
    };

    void loadInvites();
  }, [workspaceId, inviteCount]);

  const createInvite = async () => {
    if (!workspaceId) return;
    setCreating(true);
    setError(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError("Authentication required.");
        return;
      }

      const response = await fetch("/api/workspaces/invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: "create",
          workspaceId,
          role: "member",
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload.error || "Failed to create invite.");
        return;
      }

      await onInviteUpdated();
      setInvites((current) => {
        const created = payload.invite as InviteRecord | undefined;
        if (!created) return current;
        return [created, ...current.filter((invite) => invite.id !== created.id)];
      });
    } catch {
      setError("Failed to create invite.");
    } finally {
      setCreating(false);
    }
  };

  const copyInvite = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopyState(value);
      window.setTimeout(() => setCopyState(null), 1200);
    } catch {
      setError("Clipboard access failed.");
    }
  };

  return (
    <div className="space-y-8">

      <div className="flex flex-col items-center gap-6">
        <div className="flex w-full items-center justify-between px-2">
          <div className="text-[13px] font-semibold text-zinc-400">Invite Collaborators</div>
          <button
            type="button"
            onClick={createInvite}
            disabled={!workspaceId || creating}
            className="text-[12px] font-bold text-zinc-400 hover:text-white transition-colors disabled:opacity-50"
          >
            {creating ? "Generating..." : "Generate link"}
          </button>
        </div>

        {loading ? (
          <div className="flex h-20 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-zinc-700" />
          </div>
        ) : latestInvite ? (
          <div className="w-full space-y-4">
            <div className="flex flex-col items-center w-full rounded-2xl border border-white/5 bg-white/[0.01] p-6 text-center">
              <div className="text-[11px] uppercase tracking-[0.15em] text-zinc-600 font-bold mb-3">
                Team Invite Link
              </div>
              <div className="font-medium text-[13px] text-zinc-300 break-all mb-4">
                {latestInvite.url}
              </div>
              <button
                type="button"
                onClick={() => void copyInvite(latestInvite.url)}
                className="h-9 px-6 rounded-full bg-white/[0.05] border border-white/5 text-[12px] font-semibold text-zinc-300 hover:bg-white/[0.08] transition-all"
              >
                {copyState === latestInvite.url ? "Link Copied" : "Copy to Clipboard"}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex h-24 w-full items-center justify-center rounded-2xl border border-dashed border-white/10 text-[13px] text-zinc-600">
            No active invites.
          </div>
        )}
      </div>

      {error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 pt-4">
        <button
          type="button"
          onClick={onContinue}
          className="h-11 rounded-full border border-white/10 bg-white/[0.02] text-[15px] font-medium text-zinc-400 hover:bg-white/[0.05]"
        >
          {hasInvites ? "Skip for now" : "Continue"}
        </button>
        {latestInvite ? (
          <button
            type="button"
            onClick={() => void copyInvite(latestInvite.url)}
            className="h-11 rounded-full border border-white/10 bg-zinc-800 text-[15px] font-semibold text-zinc-300 transition-all hover:bg-zinc-700 active:scale-[0.98]"
          >
            {copyState === latestInvite.url ? "Invite copied" : "Copy & Continue"}
          </button>
        ) : (
          <button
            type="button"
            onClick={createInvite}
            disabled={!workspaceId || creating}
            className="h-11 rounded-full border border-white/10 bg-zinc-800 text-[15px] font-semibold text-zinc-300 transition-all hover:bg-zinc-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {creating ? "Creating..." : "Generate & continue"}
          </button>
        )}
      </div>
    </div>
  );
}
