"use client";

import React from "react";
import { motion, useMotionValue, useMotionTemplate } from "framer-motion";
import { BuiltForPurposeVisual } from "./bento-visuals/BuiltForPurposeVisual";
import { PoweredByAgentsVisual } from "./bento-visuals/PoweredByAgentsVisual";
import { DesignedForSpeedVisual } from "./bento-visuals/DesignedForSpeedVisual";

/*
 * Raycast-inspired bento grid.
 * 3 rows: hero card (scope), two bottom cards (team state + intent).
 * All styling uses the Orkestrate design system tokens.
 */

interface BentoCardData {
  id: string;
  label: string;
  headline: string;
  description: string;
  className: string;
  visual: React.ReactNode;
}

const cards: BentoCardData[] = [
  {
    id: "scope",
    label: "Teamwork",
    headline: "Zero mess. Always.",
    description:
      "Agents pick files before editing. If two try to edit the same code, we stop them. No more messy merges.",
    className: "md:col-span-3 min-h-[340px]",
    visual: <BuiltForPurposeVisual />,
  },
  {
    id: "intelligence",
    label: "Awareness",
    headline: "Agents that work together.",
    description:
      "Every agent sees what others are doing. They share the same view and the same rules.",
    className: "md:col-span-1 min-h-[300px]",
    visual: <PoweredByAgentsVisual />,
  },
  {
    id: "intent",
    label: "Work",
    headline: "Just say what you need.",
    description:
      "Just talk to the team. We handle the files and the rules for you automatically.",
    className: "md:col-span-2 min-h-[300px]",
    visual: <DesignedForSpeedVisual />,
  },
];

const BentoCard = ({
  card,
  index,
}: {
  card: BentoCardData;
  index: number;
}) => {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const handleMouseMove = ({
    currentTarget,
    clientX,
    clientY,
  }: React.MouseEvent) => {
    const { left, top } = currentTarget.getBoundingClientRect();
    mouseX.set(clientX - left);
    mouseY.set(clientY - top);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "200px" }}
      transition={{
        duration: 0.4,
        delay: index * 0.05,
        ease: [0.16, 1, 0.3, 1],
      }}
      className={`group relative rounded-[12px] bg-[#0A0A0B] border border-white/[0.05] overflow-hidden hover:border-white/[0.08] transition-colors duration-300 ${card.className}`}
      onMouseMove={handleMouseMove}
    >
      {/* Spotlight on hover */}
      <motion.div
        className="pointer-events-none absolute -inset-px rounded-[12px] opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-20"
        style={{
          background: useMotionTemplate`
            radial-gradient(
              400px circle at ${mouseX}px ${mouseY}px,
              rgba(255,255,255,0.03),
              transparent 70%
            )
          `,
        }}
      />

      {/* Background gradient for text readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0B] via-[#0A0A0B]/80 to-transparent pointer-events-none z-1" />

      {/* Visual — sits between gradient and content */}
      <div className="absolute inset-0 opacity-100 transition-opacity duration-1000 z-5 group-hover:scale-105 transition-transform">
        {card.visual}
      </div>

      {/* Text content, anchored to bottom */}
      <div className="relative h-full flex flex-col justify-end p-8 z-10">
        <span className="text-[11px] font-medium uppercase tracking-wider text-[#5E626B] mb-3">
          {card.label}
        </span>
        <h3 className="text-[22px] md:text-[24px] font-bold tracking-tight text-[#EBEBEB] mb-2 leading-tight">
          {card.headline}
        </h3>
        <p className="text-[13px] text-[#8A8F98] leading-relaxed max-w-md">
          {card.description}
        </p>
      </div>
    </motion.div>
  );
};

export const BentoGrid = () => (
  <section className="relative z-10 px-6 py-32 md:px-12 bg-[#050505]">
    <div className="max-w-[1200px] mx-auto">
      {/* Section header */}
      <motion.header
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "200px" }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="mb-14"
      >
        <span className="block text-[11px] font-medium uppercase tracking-widest text-[#5E626B] mb-5">
          Capabilities
        </span>
        <h2 className="text-[24px] md:text-[36px] font-bold tracking-tight text-white max-w-2xl leading-tight">
          Teamwork for AI teams.
        </h2>
      </motion.header>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {cards.map((card, i) => (
          <BentoCard key={card.id} card={card} index={i} />
        ))}
      </div>
    </div>
  </section>
);
