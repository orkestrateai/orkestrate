"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Logo } from "@/components/brand/Logo";
import { AlertCircle, Loader2, LogOut } from "lucide-react";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";

export default function LoginPage() {
  const supabase = createSupabaseBrowserClient();
  const searchParams = useSearchParams();
  const router = useRouter();

  const requestedNext = searchParams.get("next");
  const desktopRedirect = searchParams.get("desktop_redirect") || (searchParams.has("desktop") ? "orkestrate://auth/callback" : null);

  const safeNext = desktopRedirect || (requestedNext?.startsWith("/") ? requestedNext : "/");

  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then((res: any) => {
      if (cancelled) return;
      setChecking(false);
      if (!desktopRedirect && res?.data?.user) {
        router.replace(safeNext);
      }
    }).catch(() => { if (!cancelled) setChecking(false); });
    return () => { cancelled = true; };
  }, [supabase.auth, router, safeNext, desktopRedirect]);

  useEffect(() => {
    if (desktopRedirect) {
      supabase.auth.getUser().then((res: any) => {
        setUser(res?.data?.user ?? null);
      });
      // Also fetch user info for display
      supabase.auth.getSession().then((sessionResult: any) => {
        const { data: { session } } = sessionResult || { data: {} };
        if (session?.user) {
          setUser(session.user);
        }
      });
    }
  }, [desktopRedirect, supabase.auth]);

  const buildRedirectTo = () =>
    `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeNext)}`;

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setError(null);
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: buildRedirectTo(),
        queryParams: { prompt: "select_account" },
      },
    });
    if (error) {
      setError(error.message);
      setGoogleLoading(false);
      return;
    }
    // Full-page redirect to Google (not popup)
    if (data?.url) {
      window.location.href = data.url;
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  const handleOpenApp = (session: any) => {
    const url = new URL(safeNext);
    url.searchParams.set("access_token", session.access_token);
    url.searchParams.set("refresh_token", session.refresh_token);
    url.searchParams.set("expires_in", String(session.expires_in ?? 3600));
    window.location.href = url.toString();
  };

  if (checking && desktopRedirect) {
    return (
      <main className="min-h-screen bg-[#050505] text-[#F2F2F2] font-sans flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-white/40" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050505] text-[#F2F2F2] font-sans selection:bg-white/10 flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-[400px] space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
        {/* Logo & Header */}
        <div className="flex flex-col items-center text-center space-y-4">
          <Link href="/" className="hover:opacity-80 transition-opacity mb-4">
            <Logo size="md" withText={false} />
          </Link>
          <h1 className="text-3xl font-light tracking-tight bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent">
            {desktopRedirect ? "Sign in to Orkestrate" : "Welcome back"}
          </h1>
          <p className="text-white/40 text-sm font-light">
            {desktopRedirect
              ? "Authenticate to use the desktop app"
              : "Sign in to your workspace to continue"}
          </p>
        </div>

        {/* Auth Container */}
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl space-y-6">
          {desktopRedirect && user ? (
            <div className="space-y-4 text-center">
              <div className="flex flex-col items-center gap-3">
                <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center text-xl font-medium">
                  {user.user_metadata?.avatar_url ? (
                    <img src={user.user_metadata.avatar_url} alt="" className="w-14 h-14 rounded-full" />
                  ) : (
                    (user.email?.[0] ?? "?").toUpperCase()
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium">{user.email}</p>
                  <p className="text-xs text-white/40">Signed in with Google</p>
                </div>
              </div>
              <button
                onClick={() => {
                  supabase.auth.getSession().then((res: any) => {
                    if (res.data.session) handleOpenApp(res.data.session);
                  });
                }}
                className="w-full h-12 flex items-center justify-center gap-3 bg-white text-black hover:bg-[#F0F0F0] transition-all rounded-xl text-sm font-medium"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
                Open Orkestrate App
              </button>
              <button
                onClick={handleSignOut}
                className="w-full flex items-center justify-center gap-2 text-sm text-white/40 hover:text-white/70 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                Not you? Sign out
              </button>
            </div>
          ) : (
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
                    <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    <span>Continue with Google</span>
                  </>
                )}
              </button>
            </div>
          )}

          {error && (
            <div role="alert" className="flex items-center gap-2 text-white text-sm bg-white/5 border border-white/10 p-4 rounded-xl animate-in fade-in zoom-in-95 duration-200">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
