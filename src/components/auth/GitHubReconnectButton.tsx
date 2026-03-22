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

    // Use the same signInWithOAuth flow as the login page.
    // Supabase handles the GitHub OAuth handshake and redirects to
    // /auth/callback, which syncs the provider_token to our github_tokens
    // DB table. One callback URL, no custom route needed.
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
