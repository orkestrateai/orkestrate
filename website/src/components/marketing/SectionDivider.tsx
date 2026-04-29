"use client";

/**
 * Subtle gradient line divider between major landing page sections.
 * Fades from transparent → white/8% → transparent.
 */
export const SectionDivider = () => (
  <div className="relative z-10 w-full px-6 md:px-12">
    <div className="max-w-[1200px] mx-auto">
      <div
        className="h-px w-full"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.08) 50%, transparent 100%)",
        }}
      />
    </div>
  </div>
);
