import { motion, AnimatePresence } from 'motion/react';
import { useState, useEffect } from 'react';

const PHRASES = [
  'Pondering...',
  'Synthesizing memory...',
  'Looking through archives...',
  'Architecting response...',
  'Scanning local context...',
  'Refining intent...',
  'Connecting nodes...',
];

export function ThinkingIndicator() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % PHRASES.length);
    }, 2500);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex items-center gap-5 py-2 ml-1">
      {/* 3x3 Dither Wave Animation */}
      <div className="grid grid-cols-3 gap-1">
        {[...Array(9)].map((_, i) => {
          const row = Math.floor(i / 3);
          const col = i % 3;
          // Diagonal wave delay
          const delay = (row + col) * 0.15;
          
          return (
            <motion.div
              key={i}
              className="size-1 rounded-[1px] bg-foreground"
              animate={{
                opacity: [0.1, 0.5, 0.1],
                scale: [0.8, 1.1, 0.8],
              }}
              transition={{
                duration: 1.2,
                repeat: Infinity,
                delay: delay,
                ease: "easeInOut"
              }}
            />
          );
        })}
      </div>

      {/* Cycling Phrases */}
      <div className="h-4 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.p
            key={PHRASES[index]}
            initial={{ y: 8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -8, opacity: 0 }}
            transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
            className="text-[12px] font-medium text-white/20 tracking-tight"
          >
            {PHRASES[index]}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}
