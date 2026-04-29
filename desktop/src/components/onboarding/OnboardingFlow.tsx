import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrent, onOpenUrl } from "@tauri-apps/plugin-deep-link";

const POLL_INTERVAL = 500;
const POLL_TIMEOUT = 2 * 60 * 1000;

interface OnboardingFlowProps {
  onComplete: () => void;
}

export function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const completedRef = useRef(false);

  const complete = () => {
    if (completedRef.current) return;
    completedRef.current = true;
    onComplete();
  };

  const checkAuth = () => {
    invoke<string>("get_auth_state").then((state) => {
      if (state === "authenticated") complete();
    }).catch(() => {});
  };

  useEffect(() => {
    let cancelled = false;

    getCurrent().then((urls) => {
      if (cancelled) return;
      if (urls && urls.length > 0) setTimeout(checkAuth, 500);
    }).catch(() => {});

    const unlistenUrl = onOpenUrl(() => {
      if (!cancelled) setTimeout(checkAuth, 500);
    });

    const unlistenEvent = listen("deep-link-auth", () => {
      if (!cancelled) checkAuth();
    });

    const interval = setInterval(() => {
      if (cancelled) return;
      checkAuth();
    }, POLL_INTERVAL);

    checkAuth();

    const timeout = setTimeout(() => {
      if (!cancelled) clearInterval(interval);
    }, POLL_TIMEOUT);

    return () => {
      cancelled = true;
      clearInterval(interval);
      clearTimeout(timeout);
      unlistenUrl.then((u) => u());
      unlistenEvent.then((u) => u());
    };
  }, []);

  const handleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      await invoke("start_oauth");
      setLoading(false);
    } catch (e) {
      setError(String(e));
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-black overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23g)'/%3E%3C/svg%3E")`,
          }}
        />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-white/[0.02] blur-[120px] pointer-events-none" />
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center gap-6">
          <div className="w-8 h-8 rounded-full border-2 border-white/15 border-t-white/70 animate-spin" />
          <p className="text-[14px] text-white/30 font-light">Waiting for sign-in...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black overflow-hidden">
      {/* Ambient grain overlay */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23g)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Soft radial gradient glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-white/[0.02] blur-[120px] pointer-events-none" />

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-8">
        <div className="flex flex-col items-center gap-8 max-w-sm text-center animate-in fade-in duration-700">

          {/* Logo with subtle glow */}
          <div className="relative">
            <div className="absolute inset-0 bg-white/5 blur-2xl rounded-full scale-150" />
            <div className="w-16 h-16 relative">
              <svg viewBox="0 0 48 48" fill="none" className="w-full h-full">
                <path d="M24 42L4 32L24 22L44 32Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" className="text-white/20" />
                <path d="M24 34L4 24L24 14L44 24Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" className="text-white/40" />
                <path d="M24 34L4 24L24 14L44 24Z" className="fill-current text-white/[0.04]" />
                <path d="M24 26L4 16L24 6L44 16Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" className="text-white/70" />
                <path d="M24 26L4 16L24 6L44 16Z" className="fill-current text-white/[0.08]" />
              </svg>
            </div>
          </div>

          {/* Text */}
          <div className="space-y-3">
            <h1 className="text-[28px] font-light tracking-tight text-white/90">
              Orkestrate
            </h1>
            <p className="text-[15px] text-white/40 leading-relaxed font-light">
              Your AI companion that remembers every conversation and learns who you are.
            </p>
          </div>

          {/* Sign-in button */}
          <button
            onClick={handleSignIn}
            className="group relative w-full h-[52px] overflow-hidden rounded-xl transition-all duration-300"
          >
            <div className="absolute inset-0 bg-white transition-transform duration-300 group-hover:scale-[1.02]" />
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-r from-white/90 via-white/80 to-white/90" />
            <div className="relative z-10 flex items-center justify-center gap-3">
                {/* Google SVG icon */}
                <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                <span className="text-[15px] font-medium text-black">Continue with Google</span>
              </div>
            </button>

          {/* Error */}
          {error && (
            <div className="w-full p-4 rounded-xl bg-red-500/10 border border-red-500/15 text-sm text-red-400/90 text-left animate-in fade-in duration-200">
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Bottom subtle hint */}
      <div className="relative z-10 pb-8 text-center">
        <p className="text-[11px] text-white/[0.07] tracking-wider uppercase font-light">
          Click above to sign in with Google
        </p>
      </div>
    </div>
  );
}
