"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Particles } from "@/components/ui/particles";
import { BorderBeam } from "@/components/ui/border-beam";

/**
 * Graphic-centered feature section: [Text] → {Graphic} → [Text]
 * Used for the primary feature (Scope Coordination) to break the
 * repetitive side-by-side pattern.
 */

export interface FeatureShowcaseData {
  id: string;
  badge: string;
  headline: string;
  description: string;
  link: string;
  linkLabel: string;
  visual: React.ReactNode;
  bottomHeadline: string;
  bottomDescription: string;
}

export const FeatureShowcase = ({
  section,
}: {
  section: FeatureShowcaseData;
}) => {
  return (
    <section className="relative w-full py-24 md:py-32 overflow-hidden">
      {/* Particles background */}
      <Particles
        className="absolute inset-0 z-0"
        quantity={40}
        color="#ffffff"
        staticity={60}
        size={0.4}
        ease={50}
      />

      <div className="relative z-10 max-w-[1200px] mx-auto px-6 md:px-12">
        {/* Top text — centered */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "200px" }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="text-center max-w-2xl mx-auto mb-16"
        >
          <span className="block text-[11px] font-medium uppercase tracking-widest text-[#5E626B] mb-4">
            {section.badge}
          </span>
          <h2 className="text-[28px] md:text-[40px] font-bold tracking-tight text-white leading-[1.15] mb-5 whitespace-pre-line">
            {section.headline}
          </h2>
          <p className="text-[14px] text-[#8A8F98] leading-relaxed">
            {section.description}
          </p>
        </motion.div>

        {/* Full-width graphic with border beam */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "200px" }}
          transition={{
            duration: 0.5,
            delay: 0.1,
            ease: [0.16, 1, 0.3, 1],
          }}
          className="relative w-full max-w-[720px] mx-auto mb-16 rounded-[16px] border border-white/[0.06] bg-[#0A0A0B] overflow-hidden shadow-2xl"
        >
          <div className="p-2">{section.visual}</div>
        </motion.div>

        {/* Bottom text — centered */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "200px" }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="text-center max-w-2xl mx-auto"
        >
          <h3 className="text-[22px] md:text-[28px] font-semibold tracking-tight text-white leading-[1.2] mb-4">
            {section.bottomHeadline}
          </h3>
          <p className="text-[14px] text-[#8A8F98] leading-relaxed mb-6">
            {section.bottomDescription}
          </p>
          <Link
            href={section.link}
            className="inline-flex items-center gap-2 text-[13px] font-medium text-[#8A8F98] hover:text-[#EBEBEB] transition-colors duration-300"
          >
            {section.linkLabel}
          </Link>
        </motion.div>
      </div>
    </section>
  );
};
