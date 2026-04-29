"use client";

/**
 * Deep-dive visual: Knowledge Base
 * Shows a doc tree with a markdown preview panel.
 */
export const KnowledgeBaseDeepDive = () => (
  <div className="w-full max-w-[560px] mx-auto lg:mx-0">
    <div className="rounded-[12px] bg-[#0A0A0B] border border-white/[0.05] overflow-hidden shadow-[0_16px_64px_rgba(0,0,0,0.6)]">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-white/[0.04] flex items-center justify-between">
        <span className="text-[11px] text-[#5E626B] font-sans tracking-wide">
          knowledge_base
        </span>
        <span className="text-[10px] text-[#5E626B] bg-[#16181A] px-2 py-0.5 rounded-full border border-white/[0.04]">
          acme-app
        </span>
      </div>

      <div className="grid grid-cols-5 min-h-[260px]">
        {/* Doc tree — left panel */}
        <div className="col-span-2 border-r border-white/[0.04] p-3 space-y-0.5 text-[11px] font-sans">
          <div className="py-1.5 px-2 rounded-[6px] text-[#8A8F98] flex items-center gap-2">
            <span className="text-[10px] text-[#5E626B]">▾</span>
            Architecture
          </div>
          <div className="py-1.5 px-2 pl-5 text-[#5E626B]">API Design</div>
          <div className="py-1.5 px-2 pl-5 rounded-[6px] bg-white/[0.03] text-[#EBEBEB] border border-white/[0.05]">
            Auth Flow
          </div>
          <div className="py-1.5 px-2 pl-5 text-[#5E626B]">DB Schema</div>
          <div className="py-1.5 px-2 rounded-[6px] text-[#8A8F98] flex items-center gap-2 mt-1">
            <span className="text-[10px] text-[#5E626B]">▸</span>
            Onboarding
          </div>
          <div className="py-1.5 px-2 rounded-[6px] text-[#8A8F98] flex items-center gap-2">
            <span className="text-[10px] text-[#5E626B]">▸</span>
            Runbooks
          </div>
        </div>

        {/* Doc preview — right panel */}
        <div className="col-span-3 p-4">
          <h4 className="text-[14px] text-[#EBEBEB] font-medium mb-3">
            Auth Flow
          </h4>
          <div className="space-y-3 text-[12px] text-[#8A8F98] leading-relaxed">
            <p>
              OAuth 2.0 with PKCE for all agent authentication. Refresh tokens
              stored in the workspace credential manager with automatic rotation.
            </p>
            <div className="p-2.5 rounded-[6px] bg-[#111113] border border-white/[0.04] font-sans text-[10px] text-[#D1D3D8]">
              <span className="text-[#5E626B]">endpoint:</span>{" "}
              /auth/refresh
              <br />
              <span className="text-[#5E626B]">method:</span> POST
              <br />
              <span className="text-[#5E626B]">ttl:</span> 3600s
            </div>
            <p className="text-[10px] text-[#5E626B] pt-1 border-t border-white/[0.03]">
              Updated by opencode-a5f2 · 5 minutes ago
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
);
