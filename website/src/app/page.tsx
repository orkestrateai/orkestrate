"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import type { User, Session, AuthChangeEvent } from "@supabase/supabase-js";
import { useSearchParams } from "next/navigation";
import { Logo } from "@/components/brand/Logo";
import { BackgroundShader } from "@/components/BackgroundShader";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";
import { UserAvatar } from "@/components/brand/UserAvatar";

export default function LandingPage() {
  const searchParams = useSearchParams();
  const [user, setUser] = useState<User | null>(null);
  const heroRef = React.useRef<HTMLDivElement>(null);
  const navRef = React.useRef<HTMLElement>(null);
  const [supabase] = useState(() => createSupabaseBrowserClient());

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }: { data: { session: Session | null } }) => {
      setUser(session?.user ?? null);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, [supabase]);

  return (
    <main className="min-h-screen bg-[#050505] text-[#F2F2F2] font-sans selection:bg-white/10 overflow-x-hidden relative flex flex-col">
      {/* Hero */}
      <section className="relative w-full h-screen overflow-hidden flex flex-col items-center justify-center">
        <BackgroundShader
          onComplete={() => {
            if (heroRef.current) {
              heroRef.current.classList.remove("opacity-0", "translate-y-4", "pointer-events-none");
              heroRef.current.classList.add("opacity-100", "translate-y-0", "pointer-events-auto");
            }
            if (navRef.current) {
              navRef.current.classList.remove("opacity-0", "-translate-y-4", "pointer-events-none");
              navRef.current.classList.add("opacity-100", "translate-y-0");
            }
          }}
          hideLogo={true}
        />
        <div
          ref={heroRef}
          className="relative z-10 flex flex-col items-center px-6 text-center transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] opacity-0 translate-y-4 pointer-events-none"
        >
          <h1 className="text-5xl md:text-8xl font-light tracking-tighter mb-8 max-w-4xl bg-gradient-to-br from-white to-white/40 bg-clip-text text-transparent">
            Orkestrate
          </h1>
          <p className="max-w-xl text-[#8A8F98] text-lg md:text-xl font-light mb-12">
            Your AI that remembers you. A personal assistant that lives on your desktop, learns from every conversation, and helps you think.
          </p>
          <Link
            href={user ? "/download" : "/login"}
            className="flex items-center justify-center gap-3 bg-white text-black hover:bg-white/90 transition-all duration-300 px-10 py-5 rounded-full text-lg font-medium group shadow-[0_0_40px_rgba(255,255,255,0.1)] hover:shadow-[0_0_60px_rgba(255,255,255,0.15)] hover:scale-[1.02]"
          >
            {user ? "Download" : "Get Started"}
          </Link>
        </div>
      </section>

      {/* Navbar */}
      <nav
        ref={navRef}
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-1000 delay-300 opacity-0 -translate-y-4 pointer-events-none"
      >
        <div className="absolute inset-0 bg-[#050505]/50 backdrop-blur-xl border-b border-white/[0.05]" />
        <div className="relative flex items-center justify-between px-6 py-4 md:px-12 w-full max-w-[1440px] mx-auto">
          <Link href="/" className="hover:opacity-80 transition-opacity">
            <Logo size="sm" withText={true} />
          </Link>
          <div className="flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-2.5">
                <UserAvatar
                  src={user.user_metadata?.avatar_url}
                  email={user.email}
                  name={user.user_metadata?.full_name}
                  size="sm"
                  className="border border-white/[0.06]"
                />
              </div>
            ) : (
              <Link
                href="/login"
                className="text-[13px] text-[#8A8F98] hover:text-[#EBEBEB] transition-colors duration-300"
              >
                Sign in
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* Footer */}
      <footer className="relative z-10 px-6 py-12 border-t border-white/[0.04] bg-[#050505]">
        <div className="max-w-[1200px] mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <Logo size="sm" withText={true} />
          <p className="text-[13px] text-[#5E626B]">
            &copy; 2026 Orkestrate. All rights reserved.
          </p>
        </div>
      </footer>
    </main>
  );
}
