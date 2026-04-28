import { Logo } from '@/components/brand/Logo';
import { SidebarNav } from './SidebarNav';
import { RecentChats } from './RecentChats';
import { SidebarFooter } from './SidebarFooter';
import { cn } from '@/lib/utils';

interface SidebarProps {
  isCollapsed: boolean;
  onOpenSearch: () => void;
  onOpenSettings: () => void;
}

export function Sidebar({ isCollapsed, onOpenSearch, onOpenSettings }: SidebarProps) {
  return (
    <aside 
      className={cn(
        "flex h-full flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-all duration-300 ease-in-out overflow-hidden relative z-40",
        isCollapsed ? "w-0 border-r-0" : "w-[240px]"
      )}
    >
      <div className={cn(
        "flex flex-col h-full min-w-[240px] transition-opacity duration-200",
        isCollapsed ? "opacity-0 pointer-events-none" : "opacity-100"
      )}>
        {/* Logo — matching Littlebird: ~28px icon, ~22px text, generous but not excessive padding */}
        <div className="px-5 pt-5 pb-3">
          <Logo size="sm" />
        </div>

        {/* Navigation */}
        <SidebarNav onOpenSearch={onOpenSearch} />

        {/* Recent chats — scrollable fill */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <RecentChats />
        </div>

        {/* Footer */}
        <SidebarFooter onOpenSettings={onOpenSettings} />
      </div>
    </aside>
  );
}
