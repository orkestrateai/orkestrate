"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";

/**
 * Reusable feature deep-dive section (Linear-style).
 * Alternates text/visual placement. Visual fades out at the bottom.
 */

export interface FeatureSectionData {
  id: string;
  badge: string;
  headline: string;
  description: string;
  link: string;
  linkLabel: string;
  visual: React.ReactNode;
}

export const FeatureSection = ({
  section,
  index,
}: {
  section: FeatureSectionData;
  index: number;
}) => {
  const isReversed = index % 2 === 1;

  return (
    <section className="relative w-full py-24 md:py-32">
      {/* Top separator */}
      {index === 0 && (
        <div className="absolute top-0 left-0 right-0 h-px bg-white/[0.04]" />
      )}

      <div className="max-w-[1200px] mx-auto px-6 md:px-12">
        <div
          className={`flex flex-col ${isReversed ? "lg:flex-row-reverse" : "lg:flex-row"} items-center gap-12 lg:gap-20`}
        >
          {/* Text column */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, ease: [0.3, 0.8, 0.15, 1] }}
            className="flex-1 max-w-lg"
          >
            <span className="block text-[11px] font-medium uppercase tracking-widest text-[#5E626B] mb-4">
              {section.badge}
            </span>
            <h2 className="text-[28px] md:text-[36px] font-bold tracking-tight text-white leading-[1.15] mb-5 whitespace-pre-line">
              {section.headline}
            </h2>
            <p className="text-[14px] text-[#8A8F98] leading-relaxed mb-8">
              {section.description}
            </p>
            <Link
              href={section.link}
              className="inline-flex items-center gap-2 text-[13px] font-medium text-[#8A8F98] hover:text-[#EBEBEB] transition-colors duration-300"
            >
              {section.linkLabel}
            </Link>
          </motion.div>

          {/* Visual column — fades out at the bottom */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{
              duration: 0.6,
              delay: 0.1,
              ease: [0.3, 0.8, 0.15, 1],
            }}
            className="flex-1 w-full relative"
          >
            {/* Fade-out mask at the bottom */}
            <div
              className="relative"
              style={{
                maskImage:
                  "linear-gradient(to bottom, black 60%, transparent 100%)",
                WebkitMaskImage:
                  "linear-gradient(to bottom, black 60%, transparent 100%)",
              }}
            >
              {section.visual}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};
