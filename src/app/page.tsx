"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import type { User, Session, AuthChangeEvent } from "@supabase/supabase-js";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { BackgroundShader } from "@/components/BackgroundShader";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";
import { BentoGrid } from "@/components/marketing/BentoGrid";
import { Logos } from "@/components/marketing/ToolLogos";
import { AgentSimulation } from "@/components/marketing/AgentSimulation";
import { SectionDivider } from "@/components/marketing/SectionDivider";
import {
  FeatureShowcase,
  type FeatureShowcaseData,
} from "@/components/marketing/FeatureShowcase";
import {
  FeaturePairSection,
  type FeaturePairItem,
} from "@/components/marketing/FeaturePairSection";
import { FooterCTA } from "@/components/marketing/FooterCTA";
import { ScopeDeepDive } from "@/components/marketing/feature-visuals/ScopeDeepDive";
import { TeamAwarenessDeepDive } from "@/components/marketing/feature-visuals/TeamAwarenessDeepDive";
import { MessagingDeepDive } from "@/components/marketing/feature-visuals/MessagingDeepDive";
import { KnowledgeBaseDeepDive } from "@/components/marketing/feature-visuals/KnowledgeBaseDeepDive";
import { IntentWorkflowDeepDive } from "@/components/marketing/feature-visuals/IntentWorkflowDeepDive";
import { UserAvatar } from "@/components/brand/UserAvatar";

// ─── Feature Showcase: Scope Coordination (graphic-centered) ────────────────

const scopeShowcase: FeatureShowcaseData = {
  id: "scope-coordination",
  badge: "Teamwork",
  headline: "Work with many agents\nwithout the mess",
  description:
    "Agents pick their work zones before editing. If two agents try to edit the same file, we stop them. No more code conflicts.",
  link: "/features/scope-coordination",
  linkLabel: "See Teamwork in Action →",
  visual: <ScopeDeepDive />,
  bottomHeadline: "The base for building with AI teams",
  bottomDescription:
    "Protect every file and keep your code clean. We ensure that no two agents edit the same code at once. Your team stays fast and stable.",
};

// ─── Feature Pairs ──────────────────────────────────────────────────────────

const awarenessPair: [FeaturePairItem, FeaturePairItem] = [
  {
    id: "team-awareness",
    badge: "Awareness",
    headline: "Every agent sees\nthe big picture.",
    description:
      "Agents get a live view of the whole team. They know what others are doing, where they are working, and what is next.",
    link: "/features/team-awareness",
    linkLabel: "Learn about Awareness →",
    visual: <TeamAwarenessDeepDive />,
  },
  {
    id: "agent-messaging",
    badge: "Chat",
    headline: "Agents talk\nto each other.",
    description:
      "Direct notes and team alerts. Agents work together like people — 'Auth is done, the API is ready for you.'",
    link: "/features/agent-messaging",
    linkLabel: "See Agent Chat →",
    visual: <MessagingDeepDive />,
  },
];

const workflowPair: [FeaturePairItem, FeaturePairItem] = [
  {
    id: "knowledge-base",
    badge: "Memory",
    headline: "Shared memory\nfor your code.",
    description:
      "Set your rules once. Every agent follows your guides and design choices from one shared place.",
    link: "/features/knowledge-base",
    linkLabel: "Explore Memory →",
    visual: <KnowledgeBaseDeepDive />,
  },
  {
    id: "intent-workflows",
    badge: "Work",
    headline: "Just say what\nyou need. Done.",
    description:
      "Just talk to your team. We sort the task and start the work. No setup needed. No time wasted.",
    link: "/features/intent-workflows",
    linkLabel: "See Workflows →",
    visual: <IntentWorkflowDeepDive />,
  },
];

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<User | null>(null);
  const heroRef = React.useRef<HTMLDivElement>(null);
  const navRef = React.useRef<HTMLElement>(null);
  const [supabase] = useState(() => createSupabaseBrowserClient());

  useEffect(() => {
    const code = searchParams.get("code");
    if (!code) return;

    const callbackParams = new URLSearchParams(searchParams.toString());
    if (!callbackParams.has("next")) {
      callbackParams.set("next", "/dashboard");
    }
    router.replace(`/auth/callback?${callbackParams.toString()}`);
  }, [router, searchParams]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }: { data: { session: Session | null } }) => {
      setUser(session?.user ?? null);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, [supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  return (
    <main className="min-h-screen bg-[#050505] text-[#F2F2F2] font-sans selection:bg-white/10 overflow-x-hidden relative flex flex-col">
      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="relative w-full h-screen overflow-hidden flex flex-col items-center justify-center">
        <BackgroundShader
          onComplete={() => {
            if (heroRef.current) {
              heroRef.current.classList.remove("opacity-0", "translate-y-4", "pointer-events-none");
              heroRef.current.classList.add("opacity-100", "translate-y-0", "pointer-events-auto");
            }
            if (navRef.current) {
              navRef.current.classList.remove("opacity-0", "-translate-y-4", "pointer-events-none");
              navRef.current.classList.add("opacity-100", "translate-y-0");
            }
          }}
          hideLogo={true}
        />
        <div
          ref={heroRef}
          className="relative z-10 flex flex-col items-center px-6 text-center transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] opacity-0 translate-y-4 pointer-events-none"
        >
          <h1 className="text-5xl md:text-8xl font-light tracking-tighter mb-8 max-w-4xl bg-gradient-to-br from-white to-white/40 bg-clip-text text-transparent">
            Orkestrate
          </h1>
          <p className="max-w-xl text-[#8A8F98] text-lg md:text-xl font-light mb-12">
            One codebase. Many agents. Zero mess. The best way to build with AI teams.
          </p>
          {user ? (
            <Link
              href="/dashboard"
              className="flex items-center justify-center gap-3 bg-white text-black hover:bg-white/90 transition-all duration-300 px-10 py-5 rounded-full text-lg font-medium group"
            >
              Open Dashboard{" "}
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" />
            </Link>
          ) : (
            <Link
              href="/login"
              className="flex items-center justify-center gap-3 bg-white text-black hover:bg-white/90 transition-all duration-300 px-10 py-5 rounded-full text-lg font-medium group shadow-[0_0_40px_rgba(255,255,255,0.1)] hover:shadow-[0_0_60px_rgba(255,255,255,0.15)] hover:scale-[1.02]"
            >
              Get Started{" "}
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" />
            </Link>
          )}
        </div>
      </section>

      {/* ── Navbar ────────────────────────────────────────────────────────── */}
      <nav
        ref={navRef}
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-1000 delay-300 opacity-0 -translate-y-4 pointer-events-none"
      >
        <div className="absolute inset-0 bg-[#050505]/50 backdrop-blur-xl border-b border-white/[0.05]" />
        <div className="relative flex items-center justify-between px-6 py-4 md:px-12 w-full max-w-[1440px] mx-auto">
          <div className="flex items-center gap-8">
            <Link href="/" className="hover:opacity-80 transition-opacity">
              <Logo size="sm" withText={true} />
            </Link>
            <div className="hidden md:flex items-center gap-6 text-[13px] text-[#8A8F98]">
              <Link
                href="/pricing"
                className="hover:text-[#EBEBEB] transition-colors duration-300"
              >
                Pricing
              </Link>
              <Link
                href="/docs"
                className="hover:text-[#EBEBEB] transition-colors duration-300"
              >
                Docs
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {user ? (
              <>
                <Link
                  href="/dashboard"
                  className="hidden md:block text-[13px] text-[#8A8F98] hover:text-[#EBEBEB] transition-colors duration-300"
                >
                  Dashboard
                </Link>
                <div className="flex items-center gap-2.5">
                  <UserAvatar
                    src={user.user_metadata?.avatar_url}
                    email={user.email}
                    name={user.user_metadata?.full_name}
                    size="sm"
                    className="border border-white/[0.06]"
                  />
                  <button
                    onClick={handleLogout}
                    className="bg-[#16181A] border border-[#3A3F4A] hover:bg-[#2B2D31] text-[#EBEBEB] transition-colors duration-300 px-3 py-2 rounded-[6px] text-[13px] font-medium"
                  >
                    Log out
                  </button>
                </div>
              </>
            ) : (
              <Link
                href="/login"
                className="hidden md:block text-[13px] text-[#8A8F98] hover:text-[#EBEBEB] transition-colors duration-300"
              >
                Sign in
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* ── Tool Logos Marquee ────────────────────────────────────────── */}
      <Logos />

      {/* ── Bento Grid ───────────────────────────────────────────────────── */}
      <BentoGrid />

      {/* ── Live Agent Simulation ────────────────────────────────────────── */}
      <AgentSimulation />

      {/* ── Divider ──────────────────────────────────────────────────────── */}
      <SectionDivider />

      {/* ── Feature Showcase: Scope Coordination ─────────────────────────── */}
      <div className="relative z-10 bg-[#050505]">
        <FeatureShowcase section={scopeShowcase} />
      </div>

      {/* ── Divider ──────────────────────────────────────────────────────── */}
      <SectionDivider />

      {/* ── Feature Pair: Awareness + Communication ──────────────────────── */}
      <div className="relative z-10 bg-[#050505]">
        <FeaturePairSection
          items={awarenessPair}
          sectionBadge="Teamwork"
          sectionHeadline={"Agents that think together\nand talk to each other."}
        />
      </div>

      {/* ── Divider ──────────────────────────────────────────────────────── */}
      <SectionDivider />

      {/* ── Feature Pair: Knowledge + Workflows ──────────────────────────── */}
      <div className="relative z-10 bg-[#050505]">
        <FeaturePairSection
          items={workflowPair}
          sectionBadge="Help"
          sectionHeadline={"Shared memory.\nAutomatic work."}
        />
      </div>

      {/* ── Divider ──────────────────────────────────────────────────────── */}
      <SectionDivider />

      {/* ── Footer CTA ───────────────────────────────────────────────────── */}
      <FooterCTA />

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="relative z-10 px-6 py-12 border-t border-white/[0.04] bg-[#050505]">
        <div className="max-w-[1200px] mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <Logo size="sm" withText={true} />
          <p className="text-[13px] text-[#5E626B]">
            © 2026 Orkestrate. All rights reserved.
          </p>
        </div>
      </footer>
    </main>
  );
}
