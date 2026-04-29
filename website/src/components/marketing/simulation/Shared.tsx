"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";

export const AnimatedText = ({ text, speed = 30, delay = 0 }: { text: string; speed?: number; delay?: number }) => {
  const [displayedText, setDisplayedText] = useState("");

  useEffect(() => {
    let i = 0;
    setDisplayedText("");
    const timeout = setTimeout(() => {
      const interval = setInterval(() => {
        setDisplayedText(text.slice(0, i + 1));
        i++;
        if (i >= text.length) clearInterval(interval);
      }, speed);
      return () => clearInterval(interval);
    }, delay);
    return () => clearTimeout(timeout);
  }, [text, speed, delay]);

  return <span>{displayedText}</span>;
};

export const BlinkingCursor = () => (
  <motion.span
    animate={{ opacity: 1 }}
    transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
    className="inline-block w-2 h-3.5 bg-zinc-400 ml-1 align-middle"
  />
);

export const ToolCall = ({ name, args, delay = 0 }: { name: string; args?: string; delay?: number }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.98, y: 5 }}
    animate={{ opacity: 1, scale: 1, y: 0 }}
    transition={{ delay: delay / 1000, duration: 0.3 }}
    className="bg-[#111113] border border-white/[0.06] rounded-md p-3 font-mono text-[10px] space-y-2 relative overflow-hidden text-left"
  >
    <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-emerald-500/50" />
    <div className="flex items-center justify-between pl-1">
      <div className="flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
        <span className="text-emerald-400 font-bold uppercase tracking-widest">{name}</span>
      </div>
      <span className="text-zinc-600 font-mono">mcp::rpc</span>
    </div>
    {args && (
      <div className="text-zinc-400 leading-relaxed font-mono pl-3.5 border-l border-white/[0.06] ml-1">
        {args}
      </div>
    )}
  </motion.div>
);
