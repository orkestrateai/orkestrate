import { MessageCircle, Search } from 'lucide-react';
import { useChatStore } from '@/stores/chat-store';

interface SidebarNavProps {
  onOpenSearch: () => void;
}

export function SidebarNav({ onOpenSearch }: SidebarNavProps) {
  const { setActiveSession } = useChatStore();

  const handleNewChat = () => {
    setActiveSession(null);
  };

  return (
    <nav className="flex flex-col gap-0.5 px-3">
      <button
        onClick={handleNewChat}
        className="flex items-center gap-2 font-medium rounded-xl px-3 py-2 text-[13.5px] text-foreground/90 bg-foreground/[0.03] transition-all hover:bg-foreground/[0.06] active:scale-[0.98]"
      >
        <MessageCircle className="size-[15px] text-foreground/60" />
        New Chat
      </button>
      <button
        onClick={onOpenSearch}
        className="flex items-center gap-2 font-medium rounded-xl px-3 py-2 text-[13.5px] text-foreground/50 transition-all hover:bg-foreground/[0.04] hover:text-foreground/70 active:scale-[0.98]"
      >
        <Search className="size-[15px] text-foreground/40" />
        Search
      </button>
    </nav>
  );
}
