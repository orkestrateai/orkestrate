'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import type { User } from '@supabase/supabase-js';
import { Logo } from '@/components/brand/Logo';
import { ArrowRight } from 'lucide-react';
import { BackgroundShader } from '@/components/BackgroundShader';
import { createSupabaseBrowserClient } from '@/utils/supabase/client';

export default function VisualLabHome() {
    const [user, setUser] = useState<User | null>(null);
    const [supabase] = useState(() => createSupabaseBrowserClient());
    const fallbackAvatar = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=64&h=64&fit=crop&crop=entropy&auto=format&q=80';

    const [showUI, setShowUI] = useState(false);
    const [showNavBg, setShowNavBg] = useState(false);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
        });
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
        });
        return () => subscription.unsubscribe();
    }, [supabase]);

    const handleLogin = async () => {
        await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: `${window.location.origin}/auth/callback` },
        });
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
    };

    return (
        <main className="min-h-screen bg-[#050505] text-[#F2F2F2] font-sans selection:bg-white/10 overflow-hidden relative flex flex-col">

            <BackgroundShader
                onStartReveal={() => setShowNavBg(true)}
                onComplete={() => setShowUI(true)}
            />

            {/* Navbar */}
            <nav className="fixed top-0 left-0 right-0 z-50">
                <div className={`absolute inset-0 bg-white/[0.04] backdrop-blur-xl border-b border-white/10 transition-opacity duration-1000 ${showNavBg ? 'opacity-100' : 'opacity-0'}`} />
                <div className={`relative flex items-center justify-between px-6 py-4 md:px-12 w-full max-w-[1440px] mx-auto transition-all duration-1000 ${showUI ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 -translate-y-4 pointer-events-none'}`}>
                    <div className="flex items-center gap-8">
                        <Link href="/" className="hover:opacity-80 transition-opacity">
                            <Logo size="sm" withText={true} />
                        </Link>
                        <div className="hidden md:flex items-center gap-6 text-sm text-white/50">
                            <Link href="/docs" className="hover:text-white transition-colors">Docs</Link>
                            <Link href="/whitepaper" className="hover:text-white transition-colors">Whitepaper</Link>
                            <Link href="/changelog" className="hover:text-white transition-colors">Changelog</Link>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        {user ? (
                            <>
                                <Link href="/dashboard" className="hidden md:block text-sm text-white/60 hover:text-white transition-colors">
                                    Dashboard
                                </Link>
                                <div className="flex items-center gap-2.5">
                                    <img
                                        src={user?.user_metadata?.avatar_url || fallbackAvatar}
                                        alt="Profile"
                                        className="w-8 h-8 rounded-full object-cover border border-white/15"
                                        referrerPolicy="no-referrer"
                                        onError={(e) => {
                                            const target = e.currentTarget;
                                            if (target.src !== fallbackAvatar) target.src = fallbackAvatar;
                                        }}
                                    />
                                    <button
                                        onClick={handleLogout}
                                        className="bg-white/10 hover:bg-white/20 text-white transition-colors px-3 py-2 rounded-md text-sm font-medium"
                                    >
                                        Log out
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                <button onClick={handleLogin} className="hidden md:block text-sm text-white/50 hover:text-white transition-colors">
                                    Sign in
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </nav>

            {/* Center Content */}
            <section className={`relative z-10 flex-1 flex flex-col items-center justify-center px-6 text-center transition-all duration-1000 delay-300 ${showUI ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'}`}>
                <div className="flex flex-col items-center">
                    <h1 className="text-5xl md:text-8xl font-light tracking-tighter mb-8 max-w-4xl bg-gradient-to-br from-white to-white/40 bg-clip-text text-transparent">
                        Orkestrate
                    </h1>

                    <p className="max-w-xl text-white/50 text-lg md:text-xl font-light mb-12">
                        One codebase. Many agents. Zero collisions. The ultimate coordination layer for AI coding tools.
                    </p>

                    {user ? (
                        <Link href="/dashboard" className="relative flex items-center justify-center gap-3 bg-white text-black hover:bg-white/90 transition-all px-10 py-5 rounded-full text-lg font-medium group overflow-hidden">
                            <span className="relative z-10 flex items-center gap-2">
                                Open Dashboard
                                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            </span>
                        </Link>
                    ) : (
                        <button onClick={handleLogin} className="relative flex items-center justify-center gap-3 bg-white text-black hover:bg-[#F0F0F0] transition-all px-10 py-5 rounded-full text-lg font-medium group overflow-hidden shadow-[0_0_40px_rgba(255,255,255,0.1)] hover:shadow-[0_0_60px_rgba(255,255,255,0.2)] hover:scale-[1.02]">
                            <span className="relative z-10 flex items-center gap-2">
                                Get Started
                                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            </span>
                        </button>
                    )}
                </div>
            </section>

        </main>
    );
}
