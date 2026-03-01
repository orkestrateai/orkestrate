"use client";

import { Play } from "lucide-react";

interface PromptComposerProps {
    composer: string;
    setComposer: (v: string) => void;
    sending: boolean;
    onSend: () => void;
}

export function PromptComposer({ composer, setComposer, sending, onSend }: PromptComposerProps) {
    return (
        <div className="p-6 bg-gradient-to-t from-[#111214] to-transparent">
            <div className="max-w-3xl mx-auto flex items-center gap-2 bg-[#1A1C20] border border-[#2A2D32] rounded-xl p-2 focus-within:border-[#5E6AD2] transition-colors">
                <input
                    className="flex-1 bg-transparent border-none text-[14px] text-[#F2F2F2] placeholder:text-[#5E626B] px-3 py-1.5 focus:outline-none"
                    placeholder="Message agent..."
                    value={composer}
                    onChange={(e) => setComposer(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && onSend()}
                    disabled={sending}
                />
                <button
                    onClick={onSend}
                    disabled={sending || !composer.trim()}
                    className="bg-[#232529] p-2 rounded-lg hover:bg-[#2A2D32] disabled:opacity-50 transition-colors"
                >
                    <Play className="w-4 h-4 fill-white" />
                </button>
            </div>
        </div>
    );
}
