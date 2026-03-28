"use client";

import React from "react";

interface UserAvatarProps {
  src?: string | null;
  email?: string | null;
  name?: string | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}

const sizeClasses = {
  xs: "w-6 h-6 rounded-[22.2%]",
  sm: "w-8 h-8 rounded-[22.2%]",
  md: "w-10 h-10 rounded-[22.2%]",
  lg: "w-12 h-12 rounded-[22.2%]",
  xl: "w-16 h-16 rounded-[22.2%]",
};

export function UserAvatar({
  src,
  email,
  name,
  size = "md",
  className = "",
}: UserAvatarProps) {
  // Generate a deterministic gradient based on email if no src
  const generateGradient = (seed: string) => {
    const colors = [
      "#FF5733", "#33FF57", "#3357FF", "#F333FF", "#33FFF3",
      "#F3FF33", "#FF33A1", "#A133FF", "#33FFA1", "#FF8C00",
      "#8A2BE2", "#DEB887", "#5F9EA0", "#7FFF00", "#D2691E"
    ];
    
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    const color1 = colors[Math.abs(hash) % colors.length];
    const color2 = colors[Math.abs(hash * 2) % colors.length];
    
    return `linear-gradient(135deg, ${color1} 0%, ${color2} 100%)`;
  };

  const initial = (name || email || "?")[0].toUpperCase();
  const fallbackGradient = generateGradient(email || name || "default");

  return (
    <div
      className={`relative flex-shrink-0 overflow-hidden border border-white/[0.08] shadow-inner ${sizeClasses[size]} ${className}`}
    >
      {src ? (
        <img
          src={src}
          alt={name || "User"}
          className="w-full h-full object-cover transition-opacity duration-300"
          onLoad={(e) => (e.currentTarget.style.opacity = "1")}
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
          style={{ opacity: 0 }}
        />
      ) : (
        <div
          className="w-full h-full flex items-center justify-center text-white/90 font-medium"
          style={{ background: fallbackGradient }}
        >
          <span className={size === "xs" ? "text-[10px]" : "text-sm"}>
            {initial}
          </span>
        </div>
      )}
      
      {/* Subtle glass overlay for premium feel */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-tr from-white/5 to-transparent mix-blend-overlay" />
    </div>
  );
}
