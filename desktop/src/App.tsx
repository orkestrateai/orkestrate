import { useState, useRef, useEffect } from "react";
import { useChat } from "@ai-sdk/react";
import { Send, Menu, Plus } from "lucide-react";
import { cn } from "./lib/utils";

function App() {
  const { messages, input, handleInputChange, handleSubmit, status } = useChat({
    api: "http://localhost:3001/api/chat",
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isLoading = status === "streaming" || status === "submitted";

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() && !isLoading) {
        handleSubmit(e as unknown as React.FormEvent<HTMLFormElement>);
      }
    }
  };

  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [input]);

  return (
    <div className="flex h-screen w-screen bg-[#050505] text-[#F2F2F2] overflow-hidden">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 w-[280px] bg-[#0a0a0a] border-r border-white/[0.06] transform transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
          "md:relative md:translate-x-0",
        )}
      >
        <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
          <span className="text-sm font-medium text-[#8A8F98]">
            Conversations
          </span>
          <button className="p-1.5 rounded-md hover:bg-white/[0.06] transition-colors">
            <Plus className="w-4 h-4 text-[#8A8F98]" />
          </button>
        </div>
        <div className="p-3">
          <div className="text-[13px] text-[#5E626B] px-3 py-2">
            No conversations yet
          </div>
        </div>
      </aside>

      {/* Overlay for mobile sidebar */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06] bg-[#050505]/80 backdrop-blur-xl">
          <button
            onClick={() => setSidebarOpen(true)}
            className="md:hidden p-1.5 rounded-md hover:bg-white/[0.06] transition-colors"
          >
            <Menu className="w-5 h-5 text-[#8A8F98]" />
          </button>
          <h1 className="text-sm font-medium text-[#8A8F98]">Orkestrate</h1>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <h2 className="text-3xl font-light tracking-tight mb-4 bg-gradient-to-br from-white to-white/40 bg-clip-text text-transparent">
                What is on your mind?
              </h2>
              <p className="text-[#8A8F98] text-sm max-w-md">
                Start a conversation. Orkestrate will remember everything that
                matters.
              </p>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex gap-4 max-w-3xl mx-auto",
                message.role === "user" ? "flex-row-reverse" : "flex-row",
              )}
            >
              <div
                className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-medium flex-shrink-0",
                  message.role === "user"
                    ? "bg-white text-black"
                    : "bg-[#16181A] text-[#8A8F98] border border-white/[0.06]",
                )}
              >
                {message.role === "user" ? "You" : "AI"}
              </div>
              <div
                className={cn(
                  "rounded-2xl px-5 py-3.5 text-[15px] leading-relaxed",
                  message.role === "user"
                    ? "bg-white text-black max-w-[80%]"
                    : "bg-[#16181A] border border-white/[0.06] text-[#F2F2F2] max-w-[80%]",
                )}
              >
                {message.parts?.map((part, i) =>
                  part.type === "text" ? (
                    <span key={i} className="whitespace-pre-wrap">
                      {part.text}
                    </span>
                  ) : null,
                ) ?? message.content}
              </div>
            </div>
          ))}

          {isLoading && messages[messages.length - 1]?.role === "user" && (
            <div className="flex gap-4 max-w-3xl mx-auto">
              <div className="w-7 h-7 rounded-full bg-[#16181A] text-[#8A8F98] border border-white/[0.06] flex items-center justify-center text-[11px] font-medium flex-shrink-0">
                AI
              </div>
              <div className="bg-[#16181A] border border-white/[0.06] rounded-2xl px-5 py-3.5">
                <div className="flex gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#8A8F98] animate-bounce [animation-delay:0ms]" />
                  <span className="w-2 h-2 rounded-full bg-[#8A8F98] animate-bounce [animation-delay:150ms]" />
                  <span className="w-2 h-2 rounded-full bg-[#8A8F98] animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-white/[0.06] bg-[#050505] px-4 py-4">
          <form onSubmit={handleSubmit} className="max-w-3xl mx-auto relative">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={onKeyDown}
              placeholder="Message Orkestrate..."
              rows={1}
              className="w-full bg-[#16181A] border border-white/[0.08] rounded-2xl pl-5 pr-14 py-4 text-[15px] text-[#F2F2F2] placeholder:text-[#5E626B] focus:outline-none focus:border-white/[0.15] focus:ring-1 focus:ring-white/[0.1] resize-none transition-all"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-white text-black hover:bg-white/90 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
          <p className="text-center text-[11px] text-[#5E626B] mt-2">
            Orkestrate may produce inaccurate information. Verify important
            facts.
          </p>
        </div>
      </div>
    </div>
  );
}

export default App;
