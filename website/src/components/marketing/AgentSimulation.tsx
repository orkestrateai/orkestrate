"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, useInView } from "framer-motion";
import { RefreshCw, Lock, Activity } from "lucide-react";

import { STEPS } from "./simulation/types";
import { OpenCodeReplica } from "./simulation/OpenCodeReplica";
import { ClaudeReplica } from "./simulation/ClaudeReplica";
import { CodexReplica } from "./simulation/CodexReplica";

export const AgentSimulation = () => {
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const containerRef = useRef(null);
  // Trigger when container is 40% visible to ensure all 3 panes are largely on screen
  const isInView = useInView(containerRef, { amount: 0.4 });

  useEffect(() => {
    if (!isInView || currentStepIdx >= STEPS.length - 1) return;

    const timer = setTimeout(() => {
      setCurrentStepIdx((prev) => prev + 1);
    }, STEPS[currentStepIdx].duration);

    return () => clearTimeout(timer);
  }, [currentStepIdx, isInView]);

  const stepId = STEPS[currentStepIdx].id;

  return (
    <section className="relative z-10 px-6 py-16 md:py-20 bg-[#050505] overflow-hidden min-h-[90vh] flex flex-col justify-center">
      <div className="max-w-[1500px] mx-auto w-full">

        {/* Header Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center mb-12"
        >
          {/* Minimalist section identifier */}
          <div className="inline-flex items-center gap-2 mb-6">
            <span className="text-[10px] font-sans font-medium uppercase tracking-[0.2em] text-[#5E626B]">
              Work Together
            </span>
          </div>
          <h2 className="text-4xl md:text-5xl font-light tracking-tight text-zinc-100 mb-4">
            Collaborate in your tools,<br className="hidden md:block" />
            <span className="text-zinc-400">stay synced through Orkestrate.</span>
          </h2>
        </motion.div>

        {/* 3-Pane Simulation Grid */}
        <div ref={containerRef} className="relative group perspective-1000">
          <div className="absolute -inset-10 bg-emerald-500/5 blur-[100px] opacity-0 group-hover:opacity-100 transition-opacity duration-1000 pointer-events-none" />

          {/* CRITICAL FIX: The Grid explicitly enforces the row height */}
          <div className="relative grid grid-cols-1 lg:grid-cols-3 gap-6 lg:h-[90vh]">

            {/* Wrapper 1 */}
            <motion.div className="flex flex-col h-[600px] lg:h-full relative transform transition-transform duration-700">
              <OpenCodeReplica stepId={stepId} />
            </motion.div>

            {/* Wrapper 2: Claude */}
            <motion.div className="flex flex-col h-[600px] lg:h-full relative z-20 transform transition-transform duration-700 hover:border-emerald-500/20 lg:scale-105 shadow-[0_0_50px_rgba(0,0,0,0.5)] rounded-xl">
              <ClaudeReplica stepId={stepId} />
            </motion.div>

            {/* Wrapper 3 */}
            <motion.div className="flex flex-col h-[600px] lg:h-full relative transform transition-transform duration-700">
              <CodexReplica stepId={stepId} />
            </motion.div>

          </div>
        </div>

        {/* Deep tech telemetry bar rather than generic marketing value props */}
        {/* <div className="mt-12 max-w-3xl mx-auto flex items-center justify-between border-y border-white/[0.04] py-4 px-6 bg-gradient-to-r from-transparent via-white/[0.01] to-transparent">
          <div className="flex items-center gap-3 text-[10px] font-sans font-medium uppercase tracking-wider">
            <span className="text-[#3A3F4A]">State</span>
            <span className="text-[#8A8F98]">Synced</span>
          </div>

          <div className="flex-1 mx-8 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent relative">
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-[1px] border border-white/[0.2] bg-[#0A0A0B] rotate-45" />
          </div>

          <div className="flex items-center gap-3 text-[10px] font-sans font-medium uppercase tracking-wider">
            <span className="text-[#3A3F4A]">Latency</span>
            <span className="text-[#8A8F98]">12ms</span>
          </div>

          <div className="flex-1 mx-8 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent relative">
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-[1px] border border-white/[0.2] bg-[#0A0A0B] rotate-45" />
          </div>

          <div className="flex items-center gap-3 text-[10px] font-sans font-medium uppercase tracking-wider">
            <span className="text-[#3A3F4A]">Collisions</span>
            <span className="text-white/[0.8]">0.00%</span>
          </div>
        </div> */}

      </div>
    </section>
  );
};