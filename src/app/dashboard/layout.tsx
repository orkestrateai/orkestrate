import { ReactNode } from "react";
import GlobalSidebar from "@/components/navigation/GlobalSidebar";

export default function DashboardLayout({ children }: { children: ReactNode }) {
    return (
        <div className="flex h-screen w-screen bg-[#111214] overflow-hidden">
            <GlobalSidebar />
            <div className="flex-1 overflow-hidden relative border-l border-[#232529] flex flex-col">
                {children}
            </div>
        </div>
    );
}
