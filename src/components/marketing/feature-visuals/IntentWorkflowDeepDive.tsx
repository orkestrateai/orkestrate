"use client";

/**
 * Deep-dive visual: Intent Workflows
 * Shows how user prompts are classified into intents with different protocol behaviors.
 */
export const IntentWorkflowDeepDive = () => (
  <div className="w-full max-w-[560px] mx-auto lg:mx-0">
    <div className="rounded-[12px] bg-[#0A0A0B] border border-white/[0.05] overflow-hidden shadow-[0_16px_64px_rgba(0,0,0,0.6)]">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-white/[0.04] flex items-center justify-between">
        <span className="text-[11px] text-[#5E626B] font-sans tracking-wide">
          Smart Plan
        </span>
        <span className="text-[10px] text-[#5E626B] bg-[#16181A] px-2 py-0.5 rounded-full border border-white/[0.04]">
          Auto-Check
        </span>
      </div>

      <div className="p-4 space-y-2">
        {/* Intent rows */}
        {[
          {
            prompt: "Add OAuth refresh flow",
            intent: "Build",
            scope: true,
          },
          {
            prompt: "Help me with the auth feature",
            intent: "Help",
            scope: true,
          },
          {
            prompt: "What is everyone working on?",
            intent: "Watch",
            scope: false,
          },
          {
            prompt: "Review this before merge",
            intent: "Check",
            scope: false,
          },
          {
            prompt: "Handle tests while I do API",
            intent: "Hand-off",
            scope: true,
          },
        ].map((item) => (
          <div
            key={item.prompt}
            className="flex items-center justify-between py-2.5 px-4 rounded-[8px] bg-[#111113] border border-white/[0.04]"
          >
            <p className="text-[12px] text-[#D1D3D8] truncate max-w-[240px]">
              &quot;{item.prompt}&quot;
            </p>
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-[#EBEBEB] bg-[#1C1C1D] px-2 py-0.5 rounded-[6px] border border-white/[0.05] font-sans">
                {item.intent}
              </span>
              <span className="text-[9px] text-[#5E626B]">
                {item.scope ? "Can Edit" : "Read Only"}
              </span>
            </div>
          </div>
        ))}

        {/* Protocol chain */}
        <div className="mt-2 pt-3 border-t border-white/[0.04]">
          <div className="text-[9px] text-[#5E626B] uppercase tracking-wider font-medium mb-2">
            Auto-steps for "Build"
          </div>
          <div className="flex items-center gap-2 text-[11px] font-sans">
            <span className="text-[#D1D3D8] bg-[#111113] px-2 py-1 rounded-[6px] border border-white/[0.04]">
              Start
            </span>
            <span className="text-[#5E626B]">→</span>
            <span className="text-[#D1D3D8] bg-[#111113] px-2 py-1 rounded-[6px] border border-white/[0.04]">
              Read Team
            </span>
            <span className="text-[#5E626B]">→</span>
            <span className="text-[#D1D3D8] bg-[#111113] px-2 py-1 rounded-[6px] border border-white/[0.04]">
              Lock File
            </span>
            <span className="text-[#5E626B]">→</span>
            <span className="text-[#EBEBEB] bg-[#16181A] px-2 py-1 rounded-[6px] border border-white/[0.06]">
              Work
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
);
