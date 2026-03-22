import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { createClient } from "@/utils/supabase/server";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    return (
        <div className="flex h-screen w-screen bg-[#050505] text-[#F2F2F2] overflow-hidden">
            <Sidebar />
            <main className="flex-1 overflow-y-auto relative flex flex-col custom-scrollbar">
                {children}
            </main>
        </div>
    );
}
