"use client";

import React, { useState } from "react";
import { Github, Loader2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";
import { motion } from "motion/react";

interface GitHubReconnectButtonProps {
  className?: string;
  label?: string;
}

export function GitHubReconnectButton({
  className = "",
  label = "Connect GitHub",
}: GitHubReconnectButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleConnect = async () => {
    if (isLoading) return;
    setIsLoading(true);

    const supabase = createSupabaseBrowserClient();

    // Check if user is already logged in via a non-GitHub provider (e.g. Google).
    // If so, use linkIdentity to attach GitHub without replacing the session.
    // Otherwise fall back to the standard signInWithOAuth flow.
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const currentProvider = user?.app_metadata?.provider;
    const isNonGithubSession = user && currentProvider && currentProvider !== "github";

    if (isNonGithubSession) {
      const { error } = await supabase.auth.linkIdentity({
        provider: "github",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(window.location.pathname)}`,
          scopes: "repo read:user user:email",
        },
      });

      if (error) {
        console.error("[GitHubReconnectButton] linkIdentity:", error.message);
        setIsLoading(false);
      }
      return;
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(window.location.pathname)}`,
        scopes: "repo read:user user:email",
      },
    });

    if (error) {
      console.error("[GitHubReconnectButton]", error.message);
      setIsLoading(false);
    }
    // On success the browser navigates away — no need to reset isLoading.
  };

  return (
    <motion.button
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => void handleConnect()}
      disabled={isLoading}
      className={`
        flex items-center justify-center gap-2 font-bold transition-all
        disabled:opacity-50 disabled:cursor-not-allowed
        ${className}
      `}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Github className="w-4 h-4" />
      )}
      <span>{isLoading ? "Redirecting..." : label}</span>
    </motion.button>
  );
}
