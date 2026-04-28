import { useState, useRef, type KeyboardEvent } from 'react';
import { Send, Plus, SlidersHorizontal, Telescope, Mic, X, Mail, HardDrive, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
  showAppsBanner?: boolean;
}

export function ChatInput({
  onSend,
  disabled = false,
  placeholder = 'Ask Orkestrate',
  showAppsBanner = true,
}: ChatInputProps) {
  const [value, setValue] = useState('');
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = () => {
    if (!value.trim() || disabled) return;
    onSend(value.trim());
    setValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  };

  const showBanner = showAppsBanner && !bannerDismissed;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-6 pt-2">
      {/* Outer card container — Littlebird-matched: visible border, clean white bg, subtle shadow */}
      <div className={cn(
        'rounded-[20px] border border-foreground/[0.07] bg-card shadow-lg shadow-foreground/[0.03] transition-all duration-300',
        showBanner ? 'pb-0' : ''
      )}>
        {/* Inner input area */}
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={e => {
              setValue(e.target.value);
              handleInput();
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={1}
            disabled={disabled}
            className={cn(
              'block w-full resize-none bg-transparent px-5 pt-5 pb-14 text-[15px] text-foreground',
              'placeholder:text-muted-foreground/60 focus:outline-none',
              'min-h-[100px] max-h-[240px] rounded-t-[20px]'
            )}
          />

          {/* Bottom control bar */}
          <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-3 pb-3">
            {/* Action Group */}
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                className="rounded-lg p-2 text-foreground/30 transition-all hover:bg-foreground/[0.05] hover:text-foreground/50 active:scale-95"
                title="Add attachment"
              >
                <Plus className="size-[18px]" />
              </button>
              <button
                type="button"
                className="rounded-lg p-2 text-foreground/30 transition-all hover:bg-foreground/[0.05] hover:text-foreground/50 active:scale-95"
                title="Reasoning mode"
              >
                <SlidersHorizontal className="size-[18px]" />
              </button>
              <button
                type="button"
                className="rounded-lg p-2 text-foreground/30 transition-all hover:bg-foreground/[0.05] hover:text-foreground/50 active:scale-95"
                title="Sources"
              >
                <Telescope className="size-[18px]" />
              </button>
            </div>

            {/* Submit Group */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                className="rounded-lg p-2 text-foreground/30 transition-all hover:bg-foreground/[0.05] hover:text-foreground/50 active:scale-95"
                title="Voice input"
              >
                <Mic className="size-[18px]" />
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!value.trim() || disabled}
                className={cn(
                  'flex size-9 items-center justify-center rounded-full transition-all duration-200',
                  value.trim()
                    ? 'bg-foreground text-background shadow-sm hover:scale-105 active:scale-95'
                    : 'bg-foreground/8 text-foreground/20 cursor-not-allowed'
                )}
              >
                <Send className="size-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Context banner — warm golden-tan strip like Littlebird */}
        {showBanner && (
          <div className="flex items-center justify-between px-5 py-2 border-t border-foreground/[0.04] bg-accent/50 rounded-b-[20px]">
            <span className="text-[12px] font-medium text-muted-foreground">
              Connect your apps to get better answers
            </span>
            <div className="flex items-center gap-3">
              <div className="flex -space-x-1">
                <div className="size-6 rounded-full border-2 border-card bg-red-500/10 flex items-center justify-center">
                   <Mail className="size-3 text-red-500/70" />
                </div>
                <div className="size-6 rounded-full border-2 border-card bg-amber-500/10 flex items-center justify-center">
                   <HardDrive className="size-3 text-amber-600/70" />
                </div>
                <div className="size-6 rounded-full border-2 border-card bg-blue-500/10 flex items-center justify-center">
                   <Calendar className="size-3 text-blue-500/70" />
                </div>
              </div>
              <button
                onClick={() => setBannerDismissed(true)}
                className="rounded-full p-1 text-foreground/25 transition-colors hover:bg-foreground/5 hover:text-foreground/50"
              >
                <X className="size-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
