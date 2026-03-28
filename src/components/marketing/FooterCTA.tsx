"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

/**
 * Footer CTA section with documentation link.
 */
export const FooterCTA = () => (
  <section className="relative z-10 px-6 py-32 md:px-12 bg-[#0A0A0B]">
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "200px" }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="max-w-2xl mx-auto text-center"
    >
      <h2 className="text-[24px] md:text-[32px] font-bold tracking-tight text-white mb-5">
        Ready to orchestrate your agents?
      </h2>
      <p className="text-[#8A8F98] text-[14px] mb-10 leading-relaxed">
        Join developers building the future with multi-agent coordination.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link
          href="/login"
          className="inline-flex items-center justify-center gap-2 bg-white text-black hover:bg-white/90 transition-colors duration-300 px-8 py-3.5 rounded-[6px] text-[14px] font-medium"
        >
          Get Started Free <ArrowRight className="w-4 h-4" />
        </Link>
        <Link
          href="/docs"
          className="inline-flex items-center justify-center gap-2 bg-[#16181A] border border-[#3A3F4A] text-[#EBEBEB] hover:bg-[#2B2D31] transition-colors duration-300 px-8 py-3.5 rounded-[6px] text-[14px] font-medium"
        >
          Read Documentation
        </Link>
      </div>
    </motion.div>
  </section>
);
