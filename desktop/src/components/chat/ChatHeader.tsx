import { Star, Share2, PanelLeft } from 'lucide-react';
import { memo } from 'react';

interface ChatHeaderProps {
  title: string;
  onToggleSidebar?: () => void;
  isSidebarCollapsed?: boolean;
}

export const ChatHeader = memo(({ title, onToggleSidebar, isSidebarCollapsed }: ChatHeaderProps) => {
  return (
    <div className="flex items-center justify-between px-6 py-3">
      <div className="flex items-center gap-2 overflow-hidden">
        {onToggleSidebar && (
          <button 
            onClick={onToggleSidebar}
            className="rounded-lg p-2 text-foreground/40 transition-colors hover:bg-foreground/[0.06] hover:text-foreground/70"
            title={isSidebarCollapsed ? "Open sidebar" : "Close sidebar"}
          >
            <PanelLeft className="size-4" />
          </button>
        )}
        <h1 className="text-sm font-semibold text-foreground/90 truncate tracking-tight">{title}</h1>
      </div>
      
      <div className="flex items-center gap-1">
        <button className="rounded-lg p-2 text-foreground/40 transition-colors hover:bg-foreground/[0.06] hover:text-foreground/70">
          <Star className="size-4" />
        </button>
        <button className="rounded-lg p-2 text-foreground/40 transition-colors hover:bg-foreground/[0.06] hover:text-foreground/70">
          <Share2 className="size-4" />
        </button>
      </div>
    </div>
  );
});

ChatHeader.displayName = 'ChatHeader';
