import { useChatStore } from '@/stores/chat-store';
import { cn } from '@/lib/utils';
import { Trash2 } from 'lucide-react';

export function RecentChats() {
  const { sessions, activeSessionId, setActiveSession, deleteSession } = useChatStore();

  if (sessions.length === 0) return null;

  return (
    <div className="flex flex-col px-3 pt-6">
      {/* "Recents" — muted, small, normal case like Littlebird */}
      <span className="px-3 pb-1 text-[12px] font-medium text-muted-foreground/70">
        Recents
      </span>
      <div className="flex flex-col gap-px">
        {sessions.map(session => (
          <div
            key={session.id}
            className={cn(
              'group flex items-center justify-between rounded-lg transition-colors',
              activeSessionId === session.id
                ? 'bg-foreground/[0.06]'
                : 'hover:bg-foreground/[0.03]'
            )}
          >
            <button
              onClick={() => setActiveSession(session.id)}
              className={cn(
                'flex-1 truncate px-3 py-1 text-left text-[13px] font-[500] transition-colors',
                activeSessionId === session.id
                  ? 'text-foreground'
                  : 'text-foreground/65 hover:text-foreground/80'
              )}
            >
              {session.title}
            </button>
            <button
              onClick={e => {
                e.stopPropagation();
                deleteSession(session.id);
              }}
              className="mr-2 flex-shrink-0 opacity-0 transition-opacity group-hover:opacity-40 hover:!opacity-80 p-1"
              title="Delete chat"
            >
              <Trash2 className="size-3 text-foreground" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
