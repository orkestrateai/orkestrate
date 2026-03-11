'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BackgroundShader } from '@/components/BackgroundShader';
import { Logo } from '@/components/brand/Logo';
import { createSupabaseBrowserClient } from '@/utils/supabase/client';
import type { User } from '@supabase/supabase-js';

interface AuthorizeClientProps {
    clientId: string;
    redirectUri: string;
    responseType: string;
    state: string;
    codeChallenge: string;
    codeChallengeMethod: string;
    scope: string;
    user: User | null;
    currentUrl: string;
}

export function AuthorizeClient({
    clientId,
    redirectUri,
    responseType,
    state,
    codeChallenge,
    codeChallengeMethod,
    scope,
    user,
    currentUrl
}: AuthorizeClientProps) {
    const [showUI, setShowUI] = useState(false);
    const supabase = createSupabaseBrowserClient();

    const handleLogin = async () => {
        await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(currentUrl)}`,
            },
        });
    };

    return (
        <main className="min-h-screen bg-[#050505] text-[#F2F2F2] font-sans selection:bg-white/10 overflow-hidden relative flex flex-col items-center justify-center">
            <BackgroundShader onComplete={() => setShowUI(true)} hideLogo={true} />

            <AnimatePresence>
                {showUI && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
                        className="relative z-10 w-full max-w-lg px-6"
                    >
                        <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-3xl p-8 shadow-[0_24px_80px_rgba(0,0,0,0.5)]">
                            <div className="flex flex-col items-center mb-10">
                                <Logo size="md" withText={false} className="mb-6" />
                                <div className="text-[11px] font-bold tracking-[0.2em] uppercase text-white/30 mb-2">
                                    MCP CONNECT
                                </div>
                                <h1 className="text-3xl font-semibold tracking-tight text-white mb-2 text-center">
                                    Authorize Orkestrate
                                </h1>
                                <p className="text-[15px] text-white/40 text-center max-w-[340px] leading-relaxed">
                                    An external agent is requesting access to your workspace.
                                </p>
                            </div>

                            <div className="flex flex-col items-center gap-6 mb-10">
                                <div className="h-px w-12 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                                <p className="text-[14px] text-white/50 text-center leading-relaxed max-w-[320px]">
                                    To begin, simply tell your agent to <span className="text-emerald-400/90 font-medium">"join workspace"</span> and experience the future of coordination.
                                </p>
                                <div className="h-px w-12 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                            </div>

                            {!user ? (
                                <div className="space-y-4">
                                    <p className="text-[13px] text-white/40 text-center px-4 leading-relaxed">
                                        Please sign in to your Orkestrate account to proceed with this authorization.
                                    </p>
                                    <button
                                        onClick={handleLogin}
                                        className="w-full flex items-center justify-center gap-3 py-4 bg-white text-black hover:bg-white/90 rounded-2xl text-[15px] font-semibold transition-all shadow-[0_8px_30px_rgba(255,255,255,0.1)] active:scale-[0.98]"
                                    >
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                        </svg>
                                        Sign in with Google
                                    </button>
                                </div>
                            ) : (
                                <form method="GET" action="/api/oauth/authorize">
                                    <input type="hidden" name="response_type" value={responseType} />
                                    <input type="hidden" name="client_id" value={clientId} />
                                    <input type="hidden" name="redirect_uri" value={redirectUri} />
                                    <input type="hidden" name="state" value={state} />
                                    <input type="hidden" name="code_challenge" value={codeChallenge} />
                                    <input type="hidden" name="code_challenge_method" value={codeChallengeMethod} />
                                    <input type="hidden" name="scope" value={scope} />
                                    <input type="hidden" name="approve" value="1" />
                                    <input type="hidden" name="user_id" value={user.id} />

                                    <div className="mb-6 px-5 py-4 bg-white/[0.04] border border-white/10 rounded-2xl flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full overflow-hidden border border-white/10">
                                                {user.user_metadata?.avatar_url && (
                                                    <img src={user.user_metadata.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                                                )}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-xs font-bold text-white/40 uppercase tracking-tighter">Authorized As</span>
                                                <span className="text-[14px] font-medium text-white/90">
                                                    {user.user_metadata?.full_name || user.email}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                    </div>

                                    <button
                                        type="submit"
                                        className="w-full py-4 bg-white text-black hover:bg-white/90 rounded-2xl text-[15px] font-bold transition-all shadow-[0_8px_30px_rgba(255,255,255,0.1)] active:scale-[0.98]"
                                    >
                                        Approve Connection
                                    </button>
                                </form>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </main>
    );
}
