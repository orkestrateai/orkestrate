"use client";

import { Lock } from "lucide-react";

/**
 * Deep-dive visual: Scope Coordination
 * Detailed view of active scope claims with conflict rejection.
 */
export const ScopeDeepDive = () => (
  <div className="w-full max-w-[560px] mx-auto lg:mx-0">
    <div className="rounded-[12px] bg-[#0A0A0B] border border-white/[0.05] overflow-hidden shadow-[0_16px_64px_rgba(0,0,0,0.6)]">
      {/* Window chrome */}
      <div className="flex items-center gap-1.5 px-5 py-3.5 border-b border-white/[0.04] bg-[#0A0A0B]">
        <div className="w-[10px] h-[10px] rounded-full bg-white/[0.06]" />
        <div className="w-[10px] h-[10px] rounded-full bg-white/[0.06]" />
        <div className="w-[10px] h-[10px] rounded-full bg-white/[0.06]" />
        <span className="ml-3 text-[11px] text-[#5E626B] font-sans tracking-wide">
          active-claims — acme-app
        </span>
      </div>

      <div className="p-4 space-y-2">
        {/* Claim 1 */}
        <div className="flex items-center justify-between py-3 px-4 rounded-[8px] bg-[#111113] border border-white/[0.04]">
          <div className="flex items-center gap-3">
            <div className="w-[24px] h-[24px] rounded-[22.2%] bg-[#16181A] border border-white/[0.06] flex items-center justify-center">
              <span className="text-[9px] text-[#D1D3D8] font-sans font-bold">
                O
              </span>
            </div>
            <div>
              <div className="text-[13px] text-[#EBEBEB] font-sans">
                public/assets/**
              </div>
              <div className="text-[10px] text-[#5E626B]">
                feature/oauth-refresh
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[11px] text-[#D1D3D8] font-sans tracking-wide">
              opencode-a5f2
            </div>
            <div className="text-[10px] text-[#5E626B]">12m remaining</div>
          </div>
        </div>

        {/* Claim 2 */}
        <div className="flex items-center justify-between py-3 px-4 rounded-[8px] bg-[#111113] border border-white/[0.04]">
          <div className="flex items-center gap-3">
            <div className="w-[24px] h-[24px] rounded-[22.2%] bg-[#16181A] border border-white/[0.06] flex items-center justify-center">
              <span className="text-[9px] text-[#D1D3D8] font-sans font-bold">
                C
              </span>
            </div>
            <div>
              <div className="text-[13px] text-[#EBEBEB] font-sans">
                src/auth/service.ts
              </div>
              <div className="text-[10px] text-[#5E626B]">feature/user-api</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[11px] text-[#D1D3D8] font-sans tracking-wide">
              claude-1
            </div>
            <div className="text-[10px] text-[#5E626B]">8m remaining</div>
          </div>
        </div>

        {/* Claim 3 */}
        <div className="flex items-center justify-between py-3 px-4 rounded-[8px] bg-[#111113] border border-white/[0.04]">
          <div className="flex items-center gap-3">
            <div className="w-[24px] h-[24px] rounded-[22.2%] bg-[#16181A] border border-white/[0.06] flex items-center justify-center">
              <span className="text-[9px] text-[#D1D3D8] font-sans font-bold">
                X
              </span>
            </div>
            <div>
              <div className="text-[13px] text-[#EBEBEB] font-sans">
                src/components/**
              </div>
              <div className="text-[10px] text-[#5E626B]">
                feature/ui-refresh
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[11px] text-[#D1D3D8] font-sans tracking-wide">
              codex-3c9e
            </div>
            <div className="text-[10px] text-[#5E626B]">22m remaining</div>
          </div>
        </div>

        {/* Rejected claim */}
        <div className="mt-1 py-3 px-4 rounded-[8px] bg-[#0A0A0B] border border-dashed border-white/[0.08]">
          <div className="flex items-center gap-2 mb-1">
            <Lock className="w-3 h-3 text-[#5E626B]" />
            <span className="text-[11px] text-[#8A8F98] font-medium tracking-wide">
              Claim rejected — src/auth/login.ts
            </span>
          </div>
          <p className="text-[10px] text-[#5E626B] pl-5">
            Overlaps opencode-a5f2&apos;s active claim on src/auth/**
          </p>
        </div>
      </div>
    </div>
  </div>
);
