"use client";

import { createSupabaseBrowserClient } from "@/utils/supabase/client";

export const fetcher = async (url: string) => {
    const supabase = createSupabaseBrowserClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error("You must be signed in.");
    const res = await fetch(url, { headers: { Authorization: `Bearer ${session.access_token}` } });
    if (!res.ok) throw new Error(`Failed to load data (${res.status})`);
    return res.json();
};

export function formatTs(ts: string): string {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return ts;
    return d.toLocaleString();
}
