"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Logo } from "@/components/brand/Logo";
import { AlertCircle, Loader2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";

export default function LoginPage() {
  const supabase = createSupabaseBrowserClient();
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const requestedNext = searchParams.get("next");
  const desktopRedirect = searchParams.get("desktop_redirect");
  // For web logins, redirect to homepage. For desktop logins, redirect to localhost callback.
  const safeNext =
    desktopRedirect
      ? desktopRedirect
      : requestedNext && requestedNext.startsWith("/")
        ? requestedNext
        : "/";

  useEffect(() => {
    // Desktop flow: if already authenticated, redirect with tokens immediately
    if (desktopRedirect) {
      supabase.auth.getSession().then(({ data: { session } }: { data: { session: { access_token: string; refresh_token: string; expires_in: number } | null } }) => {
        if (session) {
          const url = new URL(desktopRedirect);
          url.searchParams.set("access_token", session.access_token);
          url.searchParams.set("refresh_token", session.refresh_token);
          url.searchParams.set("expires_in", String(session.expires_in));
          window.location.href = url.toString();
        }
      });
      return;
    }
    // Web flow: redirect immediately if already authenticated
    supabase.auth.getUser().then((res: any) => {
      if (res?.data?.user) {
        router.replace(safeNext);
      }
    });
  }, [supabase.auth, router, safeNext, desktopRedirect]);

  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buildRedirectTo = () =>
    `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeNext)}`;

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: buildRedirectTo() },
    });
    if (error) {
      setError(error.message);
      setGoogleLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#050505] text-[#F2F2F2] font-sans selection:bg-white/10 flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-[400px] space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
        {/* Logo & Header */}
        <div className="flex flex-col items-center text-center space-y-4">
          <Link href="/" className="hover:opacity-80 transition-opacity mb-4">
            <Logo size="md" withText={false} />
          </Link>
          <h1 className="text-3xl font-light tracking-tight bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent">
            Welcome back
          </h1>
          <p className="text-white/40 text-sm font-light">
            Sign in to your workspace to continue
          </p>
        </div>

        {/* Auth Container */}
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl space-y-6">
          {/* OAuth Buttons */}
          <div className="space-y-3">
            <button
              onClick={() => void handleGoogleLogin()}
              disabled={googleLoading}
              className="w-full h-12 flex items-center justify-center gap-3 bg-white text-black hover:bg-[#F0F0F0] disabled:opacity-50 transition-all rounded-xl text-sm font-medium"
            >
              {googleLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <svg
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  <span>Continue with Google</span>
                </>
              )}
            </button>


          </div>

          {error && (
            <div
              role="alert"
              className="flex items-center gap-2 text-white text-sm bg-white/5 border border-white/10 p-4 rounded-xl animate-in fade-in zoom-in-95 duration-200"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
