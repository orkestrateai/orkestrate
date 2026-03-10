import { ReactNode } from "react";
import DashboardTopNav from "@/components/navigation/GlobalSidebar";

export default function DashboardLayout({ children }: { children: ReactNode }) {
    return (
        <div className="flex flex-col h-screen w-screen bg-[#050505] text-[#F2F2F2] overflow-hidden">
            <DashboardTopNav />
            <div className="flex-1 overflow-hidden relative flex flex-col">
                {children}
            </div>
        </div>
    );
}
