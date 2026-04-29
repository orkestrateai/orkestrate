"use client";

/**
 * Deep-dive visual: Team Awareness
 * Shows a live team state dashboard with agent objectives, footprints, and statuses.
 */
export const TeamAwarenessDeepDive = () => (
  <div className="w-full max-w-[560px] mx-auto lg:mx-0">
    <div className="rounded-[12px] bg-[#0A0A0B] border border-white/[0.05] overflow-hidden shadow-[0_16px_64px_rgba(0,0,0,0.6)]">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-white/[0.04] flex items-center justify-between">
        <span className="text-[11px] text-[#5E626B] font-sans tracking-wide">
          read_team_state
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-[5px] h-[5px] rounded-full bg-white/[0.8] animate-pulse" />
          <span className="text-[10px] text-[#8A8F98] uppercase tracking-wider font-medium">live</span>
        </span>
      </div>

      <div className="p-4 space-y-3">
        {/* Agent 1 */}
        <div className="p-4 rounded-[8px] bg-[#111113] border border-white/[0.04]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-[24px] h-[24px] rounded-[22.2%] bg-[#16181A] border border-white/[0.06] flex items-center justify-center">
                <span className="text-[9px] text-[#D1D3D8] font-sans font-bold">
                  O
                </span>
              </div>
              <span className="text-[13px] text-[#EBEBEB] font-sans tracking-wide">
                opencode-a5f2
              </span>
              <span className="text-[9px] bg-white/[0.04] text-[#EBEBEB] border border-white/[0.08] px-1.5 py-0.5 rounded-full uppercase tracking-wider font-medium">
                active
              </span>
            </div>
            <span className="text-[10px] text-[#5E626B] font-sans">
              feature/oauth
            </span>
          </div>
          <div className="pl-[34px] space-y-1.5 text-[12px]">
            <div className="flex gap-3">
              <span className="text-[#5E626B] shrink-0 w-16">Objective</span>
              <span className="text-[#D1D3D8]">
                Implementing OAuth refresh token flow
              </span>
            </div>
            <div className="flex gap-3">
              <span className="text-[#5E626B] shrink-0 w-16">Footprint</span>
              <span className="text-[#8A8F98] font-sans text-[11px]">
                src/auth/
              </span>
            </div>
          </div>
        </div>

        {/* Agent 2 */}
        <div className="p-4 rounded-[8px] bg-[#111113] border border-white/[0.04]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-[24px] h-[24px] rounded-[22.2%] bg-[#16181A] border border-white/[0.06] flex items-center justify-center">
                <span className="text-[9px] text-[#D1D3D8] font-sans font-bold">
                  C
                </span>
              </div>
              <span className="text-[13px] text-[#EBEBEB] font-sans tracking-wide">
                claude-1
              </span>
              <span className="text-[9px] bg-[#0A0A0B] text-[#5E626B] border border-white/[0.04] px-1.5 py-0.5 rounded-full uppercase tracking-wider font-medium">
                planning
              </span>
            </div>
            <span className="text-[10px] text-[#5E626B] font-sans">
              feature/api
            </span>
          </div>
          <div className="pl-[34px] space-y-1.5 text-[12px]">
            <div className="flex gap-3">
              <span className="text-[#5E626B] shrink-0 w-16">Objective</span>
              <span className="text-[#D1D3D8]">
                Building user API endpoints
              </span>
            </div>
            <div className="flex gap-3">
              <span className="text-[#5E626B] shrink-0 w-16">Plan</span>
              <span className="text-[#8A8F98]">
                Validation → tests → integration
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);
