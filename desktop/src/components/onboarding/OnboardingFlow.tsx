import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { onOpenUrl } from "@tauri-apps/plugin-deep-link";

interface OnboardingFlowProps {
  onComplete: () => void;
}

export function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const completedRef = useRef(false);

  const complete = () => {
    if (completedRef.current) return;
    completedRef.current = true;
    onComplete();
  };

  useEffect(() => {
    let cancelled = false;

    // Deep link event from Rust backend — instant auth
    const unlistenDeepLink = listen("deep-link-auth", () => {
      if (!cancelled) complete();
    });

    // Also listen for deep link URLs directly (if user is already on onboarding)
    const unlistenUrl = onOpenUrl((urls) => {
      for (const url of urls) {
        if (url.includes("orkestrate://auth/callback")) {
          // Give Rust backend a moment to process
          setTimeout(() => {
            invoke<string>("get_auth_state").then((state) => {
              if (state === "authenticated") complete();
            }).catch(() => {});
          }, 500);
          break;
        }
      }
    });

    // Check if already authenticated on mount
    invoke<string>("get_auth_state")
      .then((state) => {
        if (cancelled) return;
        setChecking(false);
        if (state === "authenticated") complete();
      })
      .catch(() => {
        if (!cancelled) setChecking(false);
      });

    return () => {
      cancelled = true;
      unlistenDeepLink.then((u) => u());
      unlistenUrl.then((u) => u());
    };
  }, []);

  const handleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      await invoke("start_oauth");
      // Poll as fallback (deep link handles the fast path)
      const interval = setInterval(async () => {
        try {
          const state = await invoke<string>("get_auth_state");
          if (state === "authenticated") {
            clearInterval(interval);
            complete();
          }
        } catch {}
      }, 1500);
      setTimeout(() => clearInterval(interval), 5 * 60 * 1000);
    } catch (e) {
      setError(String(e));
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-black">
        <div className="w-6 h-6 rounded-full border-2 border-white/20 border-t-white animate-spin" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="flex flex-col items-center gap-8 max-w-md text-center">
          <div className="w-16 h-16">
            <svg viewBox="0 0 48 48" fill="none" className="w-full h-full">
              <path d="M24 42L4 32L24 22L44 32Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" className="opacity-20" />
              <path d="M24 34L4 24L24 14L44 24Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" className="opacity-40" />
              <path d="M24 34L4 24L24 14L44 24Z" className="fill-current opacity-5" />
              <path d="M24 26L4 16L24 6L44 16Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
              <path d="M24 26L4 16L24 6L44 16Z" className="fill-current opacity-10" />
            </svg>
          </div>

          <div>
            <h1 className="text-3xl font-semibold tracking-tight mb-3">
              Welcome to Orkestrate
            </h1>
            <p className="text-lg text-white/50 leading-relaxed max-w-sm">
              Your AI companion that remembers every conversation and learns who you are.
            </p>
          </div>

          <button
            onClick={handleSignIn}
            disabled={loading}
            className="w-full h-12 flex items-center justify-center gap-3 bg-white text-black hover:bg-[#F0F0F0] disabled:opacity-50 transition-all rounded-xl text-sm font-medium"
          >
            {loading ? (
              <div className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
            ) : (
              <>
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <span>Continue with Google</span>
              </>
            )}
          </button>

          {error && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400 w-full text-left">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
