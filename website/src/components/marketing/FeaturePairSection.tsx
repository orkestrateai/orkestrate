"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { BorderBeam } from "@/components/ui/border-beam";
import { DotPattern } from "@/components/ui/dot-pattern";
import { cn } from "@/lib/utils";

/**
 * Paired feature section showing two features side-by-side in bento-style cards.
 * Each card has badge, headline, description, link, and visual.
 */

export interface FeaturePairItem {
  id: string;
  badge: string;
  headline: string;
  description: string;
  link: string;
  linkLabel: string;
  visual: React.ReactNode;
}

export const FeaturePairSection = ({
  items,
  sectionBadge,
  sectionHeadline,
}: {
  items: [FeaturePairItem, FeaturePairItem];
  sectionBadge: string;
  sectionHeadline: string;
}) => {
  return (
    <section className="relative w-full py-24 md:py-32 overflow-hidden">
      {/* Dot pattern background */}
      <DotPattern
        className={cn(
          "absolute inset-0 z-0 opacity-[0.15]",
          "[mask-image:radial-gradient(600px_circle_at_center,white,transparent)]"
        )}
        cr={1}
        cx={1}
        cy={1}
      />

      <div className="relative z-10 max-w-[1200px] mx-auto px-6 md:px-12">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "200px" }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="mb-14"
        >
          <span className="block text-[11px] font-medium uppercase tracking-widest text-[#5E626B] mb-5">
            {sectionBadge}
          </span>
          <h2 className="text-[24px] md:text-[36px] font-bold tracking-tight text-white max-w-2xl leading-tight">
            {sectionHeadline}
          </h2>
        </motion.div>

        {/* Two-column grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {items.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "200px" }}
              transition={{
                duration: 0.4,
                delay: index * 0.1,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="group relative rounded-[16px] bg-[#0A0A0B] border border-white/[0.05] overflow-hidden hover:border-white/[0.08] transition-colors duration-500"
            >

              {/* Visual */}
              <div
                className="relative w-full min-h-[280px]"
                style={{
                  maskImage:
                    "linear-gradient(to bottom, black 50%, transparent 100%)",
                  WebkitMaskImage:
                    "linear-gradient(to bottom, black 50%, transparent 100%)",
                }}
              >
                <div className="absolute inset-0 flex items-center justify-center p-6">
                  {item.visual}
                </div>
              </div>

              {/* Text content */}
              <div className="relative p-8 pt-0 z-10">
                <span className="block text-[11px] font-medium uppercase tracking-widest text-[#5E626B] mb-3">
                  {item.badge}
                </span>
                <h3 className="text-[20px] md:text-[24px] font-bold tracking-tight text-[#EBEBEB] mb-3 leading-tight whitespace-pre-line">
                  {item.headline}
                </h3>
                <p className="text-[13px] text-[#8A8F98] leading-relaxed mb-6">
                  {item.description}
                </p>
                <Link
                  href={item.link}
                  className="inline-flex items-center gap-2 text-[13px] font-medium text-[#8A8F98] hover:text-[#EBEBEB] transition-colors duration-300"
                >
                  {item.linkLabel}
                </Link>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
