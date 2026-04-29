"use client";

import React from "react";

/**
 * A lightweight CSS-only dither/noise transition.
 * Uses an SVG noise filter + a CSS gradient to create an organic dissolve
 * between two sections. No WebGL, no Canvas, no performance hit.
 */
export function DitherTransition({
  height = "120px",
  className = "",
}: {
  height?: string;
  className?: string;
}) {
  return (
    <div
      className={`relative w-full pointer-events-none select-none ${className}`}
      style={{ height, marginTop: `-${height}`, zIndex: 2 }}
    >
      {/* SVG noise filter definition (invisible, just defines the filter) */}
      <svg className="absolute w-0 h-0" aria-hidden="true">
        <defs>
          <filter id="dither-noise">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.65"
              numOctaves="4"
              stitchTiles="stitch"
              result="noise"
            />
            <feColorMatrix
              type="saturate"
              values="0"
              in="noise"
              result="grayNoise"
            />
          </filter>
        </defs>
      </svg>

      {/* The gradient fade layer */}
      <div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(to bottom, transparent 0%, #050505 100%)",
        }}
      />

      {/* The noise/dither texture overlay that breaks up the gradient edge */}
      <div
        className="absolute inset-0 opacity-[0.4] mix-blend-multiply"
        style={{
          filter: "url(#dither-noise)",
          background: "#808080",
        }}
      />
    </div>
  );
}
