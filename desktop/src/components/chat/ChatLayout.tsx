import { useState, useEffect } from 'react';
import { Sidebar } from '@/components/sidebar/Sidebar';
import { EmptyState } from './EmptyState';
import { ChatView } from './ChatView';
import { SettingsModal } from '@/components/modals/SettingsModal';
import { SearchModal } from '@/components/modals/SearchModal';
import { useChatSession } from '@/hooks/use-chat-session';
import { useChatStore } from '@/stores/chat-store';

export function ChatLayout({ onSignOut }: { onSignOut: () => void }) {
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

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground transition-colors duration-300">
      {/* Sidebar */}
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        onOpenSearch={() => setSearchOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
        onSignOut={onSignOut}
      />

      {/* Main content */}
      <main className="flex flex-1 flex-col min-h-0 overflow-hidden">
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
