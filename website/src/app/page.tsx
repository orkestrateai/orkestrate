"use client";

import { motion } from "framer-motion";
import { Download, MessageCircle, Brain, Clock, Shield } from "lucide-react";
import { Logo } from "@/components/brand/Logo";

const features = [
  {
    icon: Brain,
    title: "Long-term memory",
    description:
      "Remembers facts, preferences, and context across months of conversations.",
  },
  {
    icon: Clock,
    title: "Temporal awareness",
    description:
      "Understands when things happened and how they relate to the present.",
  },
  {
    icon: MessageCircle,
    title: "Natural dialogue",
    description:
      "Talks like a person who knows you. No repeating yourself ever again.",
  },
  {
    icon: Shield,
    title: "Private by default",
    description:
      "Your memories stay on your device. Full encryption. No cloud required.",
  },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[#050505] text-[#F2F2F2] font-sans selection:bg-white/10 overflow-x-hidden relative">
      {/* Background gradient orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[10%] left-[15%] w-[500px] h-[500px] rounded-full bg-gradient-radial from-white/[0.06] to-transparent blur-[120px]" />
        <div className="absolute bottom-[15%] right-[20%] w-[400px] h-[400px] rounded-full bg-gradient-radial from-white/[0.04] to-transparent blur-[120px]" />
      </div>

      {/* Navigation */}
      <nav className="relative z-10 border-b border-white/[0.04]">
        <div className="max-w-[1200px] mx-auto px-6 py-4 flex items-center justify-between">
          <Logo size="sm" withText={true} />
          <a
            href="#download"
            className="text-[13px] text-[#8A8F98] hover:text-[#EBEBEB] transition-colors duration-300"
          >
            Download
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 pt-32 pb-20 px-6">
        <div className="max-w-[800px] mx-auto text-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="text-5xl md:text-7xl font-light tracking-tighter mb-6 bg-gradient-to-br from-white to-white/40 bg-clip-text text-transparent"
          >
            A memory agent that
            <br />
            actually remembers
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="text-lg md:text-xl text-[#8A8F98] font-light max-w-xl mx-auto mb-12"
          >
            Orkestrate is a personal AI companion with long-term memory. It
            learns who you are, remembers what matters, and never makes you
            repeat yourself.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <a
              href="#download"
              className="flex items-center gap-3 bg-white text-black hover:bg-white/90 transition-all duration-300 px-8 py-4 rounded-full text-base font-medium group shadow-[0_0_40px_rgba(255,255,255,0.1)] hover:shadow-[0_0_60px_rgba(255,255,255,0.15)] hover:scale-[1.02]"
            >
              <Download className="w-5 h-5" />
              Download for Desktop
            </a>
            <span className="text-[13px] text-[#5E626B]">
              macOS, Windows, Linux
            </span>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="relative z-10 py-24 px-6 border-t border-white/[0.04]">
        <div className="max-w-[1000px] mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-light tracking-tight mb-4">
              Built for long-term conversations
            </h2>
            <p className="text-[#8A8F98] text-lg max-w-md mx-auto">
              Most AI assistants forget everything when you close the window.
              Orkestrate remembers.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="glass-card rounded-2xl p-8 hover:bg-white/[0.04] transition-colors duration-300"
              >
                <feature.icon className="w-6 h-6 text-[#8A8F98] mb-4" />
                <h3 className="text-lg font-medium mb-2">{feature.title}</h3>
                <p className="text-[#8A8F98] text-[15px] leading-relaxed">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Download CTA */}
      <section
        id="download"
        className="relative z-10 py-24 px-6 border-t border-white/[0.04]"
      >
        <div className="max-w-[600px] mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-3xl md:text-4xl font-light tracking-tight mb-4">
              Ready to meet your memory agent?
            </h2>
            <p className="text-[#8A8F98] text-lg mb-10">
              Download Orkestrate and start a conversation that never ends.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button className="flex items-center gap-3 bg-white text-black hover:bg-white/90 transition-all duration-300 px-8 py-4 rounded-full text-base font-medium shadow-[0_0_40px_rgba(255,255,255,0.1)] hover:shadow-[0_0_60px_rgba(255,255,255,0.15)] hover:scale-[1.02]">
                <Download className="w-5 h-5" />
                Download for macOS
              </button>
              <button className="flex items-center gap-3 bg-[#16181A] border border-[#3A3F4A] hover:bg-[#2B2D31] text-[#EBEBEB] transition-all duration-300 px-8 py-4 rounded-full text-base font-medium">
                <Download className="w-5 h-5" />
                Download for Windows
              </button>
            </div>

            <p className="text-[13px] text-[#5E626B] mt-6">
              Linux build coming soon. Free during beta.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 px-6 py-12 border-t border-white/[0.04]">
        <div className="max-w-[1200px] mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <Logo size="sm" withText={true} />
          <p className="text-[13px] text-[#5E626B]">
            &copy; 2026 Orkestrate. All rights reserved.
          </p>
        </div>
      </footer>
    </main>
  );
}
