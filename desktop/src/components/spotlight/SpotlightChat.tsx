import { useState, useRef, useEffect, type KeyboardEvent } from "react";
import { getCurrentWebviewWindow, WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { emit } from "@tauri-apps/api/event";
import { Send, Command } from "lucide-react";

export function SpotlightChat() {
  const [value, setValue] = useState("");
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const windowRef = useRef<WebviewWindow | null>(null);

  useEffect(() => {
    windowRef.current = getCurrentWebviewWindow();
    // Auto-focus input when window shows
    const focusInput = () => {
      textareaRef.current?.focus();
    };
    focusInput();
    const timer = setTimeout(focusInput, 400);
    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = async () => {
    const text = value.trim();
    if (!text || sending) return;

    setSending(true);

    // Emit to main window to start a chat with this message
    await emit("spotlight-message", { text });

    // Show main window and hide spotlight
    const main = await WebviewWindow.getByLabel("main");
    if (main) {
      await main.unminimize();
      await main.show();
      await main.setFocus();
    }

    await windowRef.current?.hide();

    setValue("");
    setSending(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      windowRef.current?.hide();
    }
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  };

  return (
    <div className="w-full h-full rounded-[20px] bg-[rgba(22,22,22,0.75)] backdrop-blur-xl overflow-hidden border border-white/[0.10]">
      {/* Input area */}
      <div className="relative h-full">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            handleInput();
          }}
          onKeyDown={handleKeyDown}
          placeholder="Ask Orkestrate anything..."
          rows={1}
          disabled={sending}
          className="block w-full h-full resize-none bg-transparent px-5 pt-3 pb-10 text-[15px] text-white/90 placeholder:text-white/35 focus:outline-none"
        />

        {/* Bottom bar */}
        <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-3 pb-2.5">
          <div className="flex items-center gap-1.5 text-white/25">
            <Command className="size-3.5" />
            <span className="text-[11px]">+ Shift + O</span>
          </div>

          <button
            onClick={handleSubmit}
            disabled={!value.trim() || sending}
            className={`flex size-7 items-center justify-center rounded-full transition-all duration-200 ${
              value.trim()
                ? "bg-white/90 text-black hover:scale-105 active:scale-95"
                : "bg-white/10 text-white/20 cursor-not-allowed"
            }`}
          >
            <Send className="size-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
