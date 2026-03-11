import { createBrowserClient } from '@supabase/ssr'

export function createSupabaseBrowserClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !key) {
        console.error(
            "CRITICAL: Supabase environment variables are missing! \n" +
            "Please add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to your Vercel project settings."
        );
        // We return a proxy that will catch further errors but prevent the boot-time crash
        return {} as any;
    }

    return createBrowserClient(url, key);
}
