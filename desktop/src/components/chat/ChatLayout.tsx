import { useState, useEffect } from 'react';
import { useTheme } from '@/lib/theme';
import { Sidebar } from '@/components/sidebar/Sidebar';
import { EmptyState } from './EmptyState';
import { ChatView } from './ChatView';
import { SettingsModal } from '@/components/modals/SettingsModal';
import { SearchModal } from '@/components/modals/SearchModal';
import { useChatSession } from '@/hooks/use-chat-session';
import { useChatStore } from '@/stores/chat-store';

export function ChatLayout({
  onSignOut,
  pendingMessage,
  onClearPendingMessage,
}: {
  onSignOut: () => void;
  pendingMessage?: string | null;
  onClearPendingMessage?: () => void;
}) {
  const { resolved } = useTheme();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // Auto-collapse sidebar on window resize
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setIsSidebarCollapsed(true);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const { messages, status, sendMessage, activeSessionId } = useChatSession();
  const { sessions } = useChatStore();

  const activeSession = sessions.find(s => s.id === activeSessionId);
  const hasMessages = messages.length > 0;

  // Handle spotlight messages — sendMessage will auto-create a session
  useEffect(() => {
    if (pendingMessage) {
      sendMessage(pendingMessage);
      onClearPendingMessage?.();
    }
  }, [pendingMessage]);

  return (
    <div className="flex h-screen w-screen overflow-hidden text-foreground transition-colors duration-300">
      {/* Sidebar */}
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        onOpenSearch={() => setSearchOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
        onSignOut={onSignOut}
      />

      {/* Main content — opaque backdrop in light mode so dark acrylic doesn't bleed through */}
      <main className={`flex flex-1 flex-col min-h-0 overflow-hidden ${resolved === 'light' ? 'bg-background' : ''}`}>
        {hasMessages && activeSession ? (
          <ChatView
            title={activeSession.title}
            messages={messages}
            status={status}
            onSend={sendMessage}
            onToggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            isSidebarCollapsed={isSidebarCollapsed}
          />
        ) : (
          <EmptyState
            onSend={sendMessage}
            onToggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            isSidebarCollapsed={isSidebarCollapsed}
          />
        )}
      </main>

      {/* Modals */}
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <SearchModal
        open={searchOpen}
        onOpenChange={setSearchOpen}
        onOpenSettings={() => {
          setSearchOpen(false);
          setSettingsOpen(true);
        }}
      />
    </div>
  );
}
