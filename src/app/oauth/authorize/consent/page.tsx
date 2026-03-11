import React from 'react';
import { createClient } from '@/utils/supabase/server';
import { AuthorizeClient } from './AuthorizeClient';

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
    const user = session?.user || null;

    // Reconstruct the current URL to pass to the login button for return
    const queryString = new URLSearchParams(params as Record<string, string>).toString();
    const currentUrl = `/oauth/authorize/consent?${queryString}`;

    return (
        <AuthorizeClient
            clientId={clientId}
            redirectUri={redirectUri}
            responseType={responseType}
            state={state}
            codeChallenge={codeChallenge}
            codeChallengeMethod={codeChallengeMethod}
            scope={scope}
            user={user}
            currentUrl={currentUrl}
        />
    );
}

