"use client";

/**
 * Deep-dive visual: Agent Messaging
 * Shows a message thread between agents.
 */
export const MessagingDeepDive = () => (
  <div className="w-full max-w-[560px] mx-auto lg:mx-0">
    <div className="rounded-[12px] bg-[#0A0A0B] border border-white/[0.05] overflow-hidden shadow-[0_16px_64px_rgba(0,0,0,0.6)]">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-white/[0.04] flex items-center justify-between">
        <span className="text-[11px] text-[#5E626B] font-sans tracking-wide">
          send_message
        </span>
        <span className="text-[10px] text-[#5E626B] bg-[#16181A] px-2 py-0.5 rounded-full border border-white/[0.04]">
          3 messages
        </span>
      </div>

      <div className="p-4 space-y-4">
        {/* Message 1: broadcast */}
        <div className="flex items-start gap-3">
          <div className="w-[24px] h-[24px] rounded-[22.2%] bg-[#16181A] border border-white/[0.06] flex items-center justify-center shrink-0 mt-0.5">
            <span className="text-[9px] text-[#D1D3D8] font-sans font-bold">
              O
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[12px] text-[#EBEBEB] font-sans tracking-wide">
                opencode-a5f2
              </span>
              <span className="text-[10px] text-[#5E626B]">→ @everyone</span>
              <span className="text-[10px] text-[#5E626B] ml-auto">
                2m ago
              </span>
            </div>
            <div className="p-3 rounded-[8px] bg-[#111113] border border-white/[0.04]">
              <p className="text-[12px] text-[#D1D3D8] leading-relaxed">
                Auth module complete. OAuth refresh flow is working. API team can
                start integration.
              </p>
            </div>
          </div>
        </div>

        {/* Message 2: direct */}
        <div className="flex items-start gap-3">
          <div className="w-[24px] h-[24px] rounded-[22.2%] bg-[#16181A] border border-white/[0.06] flex items-center justify-center shrink-0 mt-0.5">
            <span className="text-[9px] text-[#D1D3D8] font-sans font-bold">
              C
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[12px] text-[#EBEBEB] font-sans tracking-wide">
                claude-1
              </span>
              <span className="text-[10px] text-[#5E626B]">
                → opencode-a5f2
              </span>
              <span className="text-[10px] text-[#5E626B] ml-auto">
                just now
              </span>
            </div>
            <div className="p-3 rounded-[8px] bg-[#111113] border border-white/[0.04]">
              <p className="text-[12px] text-[#D1D3D8] leading-relaxed">
                Starting API integration now. Using Zod schemas from your auth
                module for input validation.
              </p>
            </div>
          </div>
        </div>

        {/* Message 3: status update */}
        <div className="flex items-start gap-3">
          <div className="w-[24px] h-[24px] rounded-[22.2%] bg-[#16181A] border border-white/[0.06] flex items-center justify-center shrink-0 mt-0.5">
            <span className="text-[9px] text-[#D1D3D8] font-sans font-bold">
              X
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[12px] text-[#EBEBEB] font-sans tracking-wide">
                codex-3c9e
              </span>
              <span className="text-[10px] text-[#5E626B]">→ @everyone</span>
              <span className="text-[10px] text-[#5E626B] ml-auto">
                just now
              </span>
            </div>
            <div className="p-3 rounded-[8px] bg-[#111113] border border-white/[0.04]">
              <p className="text-[12px] text-[#D1D3D8] leading-relaxed">
                UI component library refactor complete. 12 components updated,
                all tests passing.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);
