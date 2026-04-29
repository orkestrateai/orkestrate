import { ChatInput } from './ChatInput';
import { SuggestionChips } from './SuggestionChips';
import { ChatHeader } from './ChatHeader';

interface EmptyStateProps {
  onSend: (text: string) => void;
  disabled?: boolean;
  onToggleSidebar: () => void;
  isSidebarCollapsed: boolean;
}

export function EmptyState({ onSend, disabled, onToggleSidebar, isSidebarCollapsed }: EmptyStateProps) {
  return (
    <div className="flex flex-1 flex-col h-full overflow-hidden">
      <ChatHeader 
        title="Orkestrate" 
        onToggleSidebar={onToggleSidebar}
        isSidebarCollapsed={isSidebarCollapsed}
      />
      
      <div className="flex-1 flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-2xl space-y-8 -mt-20">
          {/* Greeting */}
          <div className="text-center">
            <h1 className="text-[28px] font-semibold tracking-tight text-foreground">
              What's on your mind today?
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Ask me anything or try one of these suggestions.
            </p>
          </div>

          {/* Input */}
          <ChatInput onSend={onSend} disabled={disabled} />

          {/* Suggestions */}
          <SuggestionChips onSelect={onSend} />
        </div>
      </div>
    </div>
  );
}
