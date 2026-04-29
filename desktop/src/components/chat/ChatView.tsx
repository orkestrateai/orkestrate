import { useRef, useEffect, memo } from 'react';
import { ChatHeader } from './ChatHeader';
import { ChatInput } from './ChatInput';
import { cn } from '@/lib/utils';
import { ArrowDown } from 'lucide-react';
import type { UIMessage } from '@ai-sdk/react';
import { ToolSteps } from './ToolSteps';
import { ThinkingIndicator } from './ThinkingIndicator';
import { Streamdown } from 'streamdown';
import { code } from '@streamdown/code';
import { cjk } from '@streamdown/cjk';
import { math } from '@streamdown/math';
import { mermaid } from '@streamdown/mermaid';

const streamdownPlugins = { cjk, code, math, mermaid };

const ChatMessage = memo(({ message, isLast, isStreaming }: { message: UIMessage, isLast: boolean, isStreaming: boolean }) => {
  const rendered: React.ReactNode[] = [];
  const allToolInvocations: any[] = [];

  // Extract all tool invocations from parts
  message.parts.forEach((part: any) => {
    const isToolPart = part.type === 'tool-invocation' || part.type.startsWith('tool-');
    if (isToolPart) {
      const toolName = part.type === 'tool-invocation' 
        ? (part.toolInvocation?.toolName || 'unknown')
        : part.type.slice(5);

      const toolCallId = part.toolCallId || part.toolInvocation?.toolCallId;
      const args = part.input || part.toolInvocation?.args;
      const result = part.output || part.toolInvocation?.result;
      
      let state: 'call' | 'result' = 'call';
      if (part.state === 'output-available' || part.state === 'result' || part.state === 'output-error') {
        state = 'result';
      }

      allToolInvocations.push({
        toolCallId,
        toolName,
        args,
        state,
        result
      });
    } else if (part.type === 'tool-call') {
      allToolInvocations.push(part.toolCall);
    }
  });

  // Handle top-level toolInvocations (v3 fallback)
  const raw = message as any;
  if (raw.toolInvocations) {
    allToolInvocations.push(...raw.toolInvocations);
  }

  // Filter unique invocations by ID
  const uniqueInvocations = Array.from(
    new Map(allToolInvocations.map(inv => [inv.toolCallId, inv])).values()
  );

  // Render text and reasoning parts
  message.parts.forEach((part: any, i) => {
    if (part.type === 'text') {
      if (part.text.trim()) {
        rendered.push(
          <div key={`${message.id}-${i}`} className="prose dark:prose-invert prose-sm max-w-none mb-6 last:mb-0">
            <Streamdown plugins={streamdownPlugins} isAnimating={isLast && isStreaming}>
              {part.text}
            </Streamdown>
          </div>
        );
      }
    } else if (part.type === 'reasoning') {
      const reasoningText = part.text || part.reasoning;
      if (reasoningText) {
        rendered.push(
          <details
            key={`${message.id}-${i}`}
            className="mb-6 rounded-2xl border border-foreground/[0.04] bg-foreground/[0.02]"
            open
          >
            <summary className="cursor-pointer px-4 py-2.5 text-[12px] font-medium text-foreground/40 hover:text-foreground/60">
              💭 Reasoning
            </summary>
            <div className="px-4 pb-4 text-[13px] text-foreground/30 leading-relaxed">
              <Streamdown plugins={streamdownPlugins} isAnimating={isLast && isStreaming}>
                {reasoningText}
              </Streamdown>
            </div>
          </details>
        );
      }
    }
  });

  return (
    <div
      className={cn(
        'flex flex-col gap-2.5 w-full',
        message.role === 'user' ? 'items-end' : 'items-start'
      )}
    >
      <div
        className={cn(
          'max-w-[88%] text-[15px] leading-[1.65]',
          message.role === 'user'
            ? 'rounded-2xl bg-foreground/[0.07] px-4.5 py-3 text-foreground/90 shadow-sm border border-foreground/[0.03]'
            : 'bg-transparent text-foreground/85'
        )}
      >
        {/* Tool summary at the top for assistant messages */}
        {message.role === 'assistant' && uniqueInvocations.length > 0 && (
          <ToolSteps invocations={uniqueInvocations} />
        )}
        
        {rendered}
      </div>
    </div>
  );
});

ChatMessage.displayName = 'ChatMessage';

interface ChatViewProps {
  title: string;
  messages: UIMessage[];
  status: string;
  onSend: (text: string) => void;
  onToggleSidebar: () => void;
  isSidebarCollapsed: boolean;
}

export function ChatView({ title, messages, status, onSend, onToggleSidebar, isSidebarCollapsed }: ChatViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isThinking = status === 'submitted' || status === 'streaming';

  // Auto-scroll on new messages / streaming
  useEffect(() => {
    // Use behavior 'auto' (instant) during streaming to avoid laggy smooth scroll jumps
    bottomRef.current?.scrollIntoView({ behavior: isThinking ? 'auto' : 'smooth' });
  }, [messages, isThinking]);

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="flex flex-1 flex-col h-full min-h-0 overflow-hidden">
      <ChatHeader 
        title={title} 
        onToggleSidebar={onToggleSidebar}
        isSidebarCollapsed={isSidebarCollapsed}
      />

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto scroll-smooth min-h-0 h-0 w-full">
        <div className="mx-auto max-w-3xl px-6 py-10 space-y-12">
          {messages.map((message, index) => (
            <ChatMessage 
              key={message.id} 
              message={message} 
              isLast={index === messages.length - 1} 
              isStreaming={isThinking} 
            />
          ))}

          {/* Streaming indicator */}
          {isThinking && (
            <ThinkingIndicator />
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Scroll to bottom FAB */}
      <div className="relative h-0">
        <button
          onClick={scrollToBottom}
          className="absolute -top-16 left-1/2 -translate-x-1/2 rounded-full border border-foreground/[0.08] bg-background/40 backdrop-blur-md p-2.5 text-foreground/30 shadow-2xl transition-all hover:bg-foreground/[0.1] hover:text-foreground/60 active:scale-90"
        >
          <ArrowDown className="size-4" />
        </button>
      </div>

      {/* Input */}
      <ChatInput 
        onSend={onSend} 
        disabled={isThinking} 
        showAppsBanner={messages.length === 0}
      />
    </div>
  );
}
