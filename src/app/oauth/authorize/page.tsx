import React from 'react';
import { createClient } from '@/utils/supabase/server';
import LoginButton from './LoginButton';

export default async function AuthorizePage({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | undefined }>
}) {
    const params = await searchParams;
    const clientId = params.client_id || "";
    const redirectUri = params.redirect_uri ? decodeURIComponent(params.redirect_uri) : "";
    const responseType = params.response_type || "";
    const state = params.state || "";
    const codeChallenge = params.code_challenge || "";
    const codeChallengeMethod = params.code_challenge_method || "";
    const scope = params.scope || "";

    // Check user session
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;

    // Reconstruct the current URL to pass to the login button for return
    const queryString = new URLSearchParams(params as Record<string, string>).toString();
    const currentUrl = `/oauth/authorize?${queryString}`;

    return (
        <main className="relative min-h-screen flex items-center justify-center px-6 py-12">
            <div className="bg-animation" suppressHydrationWarning />

            <div className="relative z-10 w-full max-w-md rounded-xl border border-border bg-card p-8 text-left">
                <div className="text-sm font-medium tracking-widest uppercase text-muted-foreground mb-6">
                    <span className="brand-orb" /> MCP CONNECT
                </div>

                <h1 className="text-2xl font-semibold tracking-tight mb-8">Authorize Agentalk</h1>

                <div className="mb-5">
                    <span className="block text-xs text-muted-foreground mb-2 tracking-wide">Client ID</span>
                    <code className="block px-4 py-3 text-xs font-mono bg-secondary/30 border border-border rounded-lg text-foreground/80 break-all">
                        {clientId}
                    </code>
                </div>

                <div className="mb-8">
                    <span className="block text-xs text-muted-foreground mb-2 tracking-wide">Redirect URI</span>
                    <code className="block px-4 py-3 text-xs font-mono bg-secondary/30 border border-border rounded-lg text-foreground/80 break-all">
                        {redirectUri}
                    </code>
                </div>

                {!user ? (
                    <div className="mt-8">
                        <p className="text-sm text-muted-foreground mb-4">
                            You must be signed in to Agentalk to authorize this connection.
                        </p>
                        <LoginButton nextUrl={currentUrl} />
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

                        <div className="mb-6 px-4 py-3 bg-success/10 border border-success/30 rounded-lg flex items-center gap-3">
                            <div className="w-6 h-6 rounded-full overflow-hidden shrink-0">
                                {user.user_metadata?.avatar_url && (
                                    <img src={user.user_metadata.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                                )}
                            </div>
                            <span className="text-sm">
                                Signed in as <strong>{user.user_metadata?.full_name || user.email}</strong>
                            </span>
                        </div>

                        <button
                            type="submit"
                            className="w-full py-3 px-4 bg-secondary/50 hover:bg-secondary border border-border rounded-lg text-sm font-medium transition-all duration-200"
                        >
                            Approve Connection
                        </button>
                    </form>
                )}
            </div>
        </main>
    );
}
