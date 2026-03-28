"use client";

import { useState, useEffect, useCallback } from "react";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";

export interface GitHubRepo {
  full_name: string;
  name: string;
  url: string;
  default_branch: string;
  description?: string;
  private?: boolean;
}

export interface GitHubBranch {
  name: string;
}

export interface UseGitHubConnectionReturn {
  // Connection status
  isConnected: boolean;
  isChecking: boolean;
  isDisconnecting: boolean;
  disconnect: () => Promise<void>;

  // Repos
  repos: GitHubRepo[];
  isLoadingRepos: boolean;
  isBrowsingRepos: boolean;
  setIsBrowsingRepos: (v: boolean) => void;
  fetchRepos: () => Promise<void>;

  // Branches
  branches: GitHubBranch[];
  isLoadingBranches: boolean;
  fetchBranches: (repoUrl: string) => Promise<void>;
  clearBranches: () => void;
}

export function useGitHubConnection(): UseGitHubConnectionReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [isLoadingRepos, setIsLoadingRepos] = useState(false);
  const [isBrowsingRepos, setIsBrowsingRepos] = useState(false);

  const [branches, setBranches] = useState<GitHubBranch[]>([]);
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);

  const checkConnection = useCallback(async () => {
    setIsChecking(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setIsConnected(false);
        return;
      }

      const res = await fetch("/api/github/status", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setIsConnected(data.connected ?? false);
      } else {
        setIsConnected(false);
      }
    } catch {
      setIsConnected(false);
    } finally {
      setIsChecking(false);
    }
  }, []);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    void checkConnection();

    // Handle Supabase OAuth callback redirect — sync token if ?code is present.
    // onAuthStateChange fires once the session is set so no explicit
    // checkConnection() call is needed here; the listener below handles it.
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has("code")) {
      (async () => {
        try {
          await fetch("/api/github/sync-token", { method: "POST" });
        } catch (err) {
          console.error("Failed to sync GitHub token:", err);
        }
        window.history.replaceState({}, "", window.location.pathname);
      })();
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void checkConnection();
    });

    return () => subscription.unsubscribe();
  }, [checkConnection]);

  const fetchRepos = useCallback(async () => {
    setIsLoadingRepos(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const res = await fetch("/api/git/repos", {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });

      if (res.status === 401) {
        throw new Error("GitHub session expired. Please reconnect.");
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to fetch repositories.");
      }

      const data = await res.json();
      setRepos(data.repos ?? []);
      setIsBrowsingRepos(true);
    } finally {
      setIsLoadingRepos(false);
    }
  }, []);

  const fetchBranches = useCallback(async (repoUrl: string) => {
    const match = repoUrl.match(/github\.com\/([^/]+)\/([^/.]+)/);
    if (!match) return;

    const [, owner, repo] = match;
    setIsLoadingBranches(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const res = await fetch(`/api/git/branches?owner=${owner}&repo=${repo}`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setBranches(data.branches ?? []);
      }
    } catch (err) {
      console.error("Failed to fetch branches:", err);
    } finally {
      setIsLoadingBranches(false);
    }
  }, []);

  const clearBranches = useCallback(() => {
    setBranches([]);
  }, []);

  const disconnect = useCallback(async () => {
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

      setIsConnected(false);
      setRepos([]);
      setBranches([]);
      setIsBrowsingRepos(false);
    } catch (err) {
      console.error("Failed to disconnect GitHub:", err);
    } finally {
      setIsDisconnecting(false);
    }
  }, []);

  return {
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
    clearBranches,
  };
}
