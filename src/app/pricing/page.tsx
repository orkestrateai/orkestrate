"use client";

import React, { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import Script from "next/script";
import useSWR from "swr";
import { motion, AnimatePresence } from "motion/react";
import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { User, Session } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";

const pricingFetcher = (url: string) => {
  const supabase = createSupabaseBrowserClient();
  return supabase.auth
    .getSession()
    .then(({ data: { session } }: { data: { session: any } }) => {
      return fetch(url, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      }).then((res) => res.json());
    });
};

interface PlanCardProps {
  name: string;
  price: string;
  originalPrice?: string;
  period?: string;
  periodNote?: string;
  description: string;
  features: string[];
  isPopular?: boolean;
  buttonText: string;
  onSelect: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  current?: boolean;
  index: number;
}

const PlanCard = ({
  name,
  price,
  originalPrice,
  period,
  periodNote,
  description,
  features,
  isPopular,
  buttonText,
  onSelect,
  isLoading,
  current,
  index,
}: PlanCardProps) => (
  <motion.div
    initial={{ opacity: 0, y: 24 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{
      duration: 0.5,
      delay: index * 0.1,
      ease: [0.25, 0.1, 0.25, 1],
    }}
    className={`relative flex flex-col ${
      isPopular
        ? "border border-white/20 bg-white/[0.04]"
        : "border border-white/[0.07] bg-transparent"
    } rounded-2xl overflow-hidden`}
  >
    {isPopular && (
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
    )}

    <div className="p-8 flex flex-col flex-1">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <span className="text-[11px] font-medium tracking-[0.2em] uppercase text-white/30">
            {name}
          </span>
          {isPopular && (
            <span className="text-[10px] tracking-widest uppercase text-white/40 border border-white/10 rounded-full px-3 py-1">
              Launch offer
            </span>
          )}
          {current && (
            <span className="text-[10px] tracking-widest uppercase text-white/30 border border-white/[0.07] rounded-full px-3 py-1">
              Current
            </span>
          )}
        </div>

        {/* Price */}
        <div className="flex items-end gap-2 mb-1">
          <span
            className={`font-light tracking-tight text-white ${price === "Free" ? "text-5xl" : "text-5xl"}`}
          >
            {price}
          </span>
          {originalPrice && (
            <span className="text-white/20 text-xl line-through mb-1 font-light">
              {originalPrice}
            </span>
          )}
          {period && (
            <span className="text-white/30 text-base mb-1 font-light">
              {period}
            </span>
          )}
        </div>

        {periodNote && (
          <p className="text-white/25 text-[11px] tracking-wide mb-4">
            {periodNote}
          </p>
        )}

        <p className="text-white/40 text-sm leading-relaxed font-light">
          {description}
        </p>
      </div>

      {/* CTA */}
      <button
        onClick={onSelect}
        disabled={isLoading || current}
        className={`w-full py-3.5 px-6 rounded-xl text-sm font-medium tracking-wide transition-all duration-300 mb-8 flex items-center justify-center gap-2 ${
          current
            ? "bg-transparent border border-white/[0.07] text-white/20 cursor-default"
            : isPopular
              ? "bg-white text-black hover:bg-white/90 active:scale-[0.98]"
              : "bg-white/[0.06] text-white/70 hover:bg-white/10 border border-white/[0.07] hover:border-white/15 active:scale-[0.98]"
        }`}
      >
        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : buttonText}
      </button>

      {/* Divider */}
      <div className="h-px bg-white/[0.06] mb-8" />

      {/* Features */}
      <ul className="space-y-3.5 flex-1">
        {features.map((feature, i) => (
          <li key={i} className="flex items-start gap-3">
            <div className="mt-0.5 flex-shrink-0">
              <Check className="w-3.5 h-3.5 text-white/30" strokeWidth={2.5} />
            </div>
            <span className="text-white/50 text-sm font-light leading-snug">
              {feature}
            </span>
          </li>
        ))}
      </ul>
    </div>
  </motion.div>
);

const PRICING_CONFIG = {
  IN: {
    symbol: "₹",
    pro: {
      price: "299",
      original: "799",
      note: "First month · then ₹799/mo, cancel anytime",
      button: "Start for ₹299",
    },
    team: {
      price: "799",
      original: "1,499",
      note: "First month · then ₹1,499/mo, cancel anytime",
    },
  },
  GLOBAL: {
    symbol: "$",
    pro: {
      price: "4",
      original: "10",
      note: "First month · then $10/mo, cancel anytime",
      button: "Start for $4",
    },
    team: {
      price: "10",
      original: "19",
      note: "First month · then $19/mo, cancel anytime",
    },
  },
};

export default function PricingPage() {
  const { data: subData, mutate } = useSWR(
    "/api/payments/status",
    pricingFetcher,
  );
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [country, setCountry] = useState<string>("IN");
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const fallbackAvatar =
    "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=64&h=64&fit=crop&crop=entropy&auto=format&q=80";

  React.useEffect(() => {
    // Detect country
    fetch("/api/payments/detect-location")
      .then((res) => res.json())
      .then((data) => setCountry(data.country || "IN"))
      .catch(() => setCountry("IN"));

    supabase.auth
      .getSession()
      .then(({ data: { session } }: { data: { session: Session | null } }) => {
        setUser(session?.user ?? null);
      });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event: any, session: Session | null) => {
        setUser(session?.user ?? null);
      },
    );
    return () => subscription.unsubscribe();
  }, [supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleUpgrade = async (planType: string) => {
    if (planType === "hobby") return;
    setLoadingPlan(planType);
    setError(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        window.location.href = `/login?returnTo=/pricing`;
        return;
      }

      const res = await fetch("/api/payments/create-subscription", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ planType }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        subscription_id: data.subscriptionId,
        name: "Orkestrate",
        description: `${planType === "pro" ? "Pro" : "Team"} Subscription`,
        image: "/logo.png",
        handler: async (response: any) => {
          const verifyRes = await fetch("/api/payments/verify", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session?.access_token}`,
            },
            body: JSON.stringify({ ...response, planType }),
          });

          if (verifyRes.ok) {
            mutate();
            alert("Upgrade successful!");
          } else {
            setError("Verification failed. Please contact support.");
          }
        },
        theme: { color: "#000000" },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoadingPlan(null);
    }
  };

  const currentPlan = subData?.planType || "hobby";

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-white/10">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" />

      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50">
        <div className="absolute inset-0 bg-white/[0.04] backdrop-blur-xl border-b border-white/10" />
        <div className="relative flex items-center justify-between px-6 py-4 md:px-12 w-full max-w-[1440px] mx-auto">
          <div className="flex items-center gap-8">
            <Link href="/" className="hover:opacity-80 transition-opacity">
              <Logo size="sm" withText={true} />
            </Link>
            <div className="hidden md:flex items-center gap-6 text-sm text-white/50">
              <Link href="/pricing" className="text-white">
                Pricing
              </Link>
              <Link href="/docs" className="hover:text-white transition-colors">
                Docs
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {user ? (
              <>
                <Link
                  href="/dashboard"
                  className="hidden md:block text-sm text-white/60 hover:text-white transition-colors"
                >
                  Dashboard
                </Link>
                <div className="flex items-center gap-2.5">
                  <img
                    src={user?.user_metadata?.avatar_url || fallbackAvatar}
                    alt="Profile"
                    className="w-8 h-8 rounded-full object-cover border border-white/15"
                    referrerPolicy="no-referrer"
                  />
                  <button
                    onClick={handleLogout}
                    className="bg-white/10 hover:bg-white/20 text-white transition-colors px-3 py-2 rounded-md text-sm font-medium"
                  >
                    Log out
                  </button>
                </div>
              </>
            ) : (
              <Link
                href="/login"
                className="px-5 py-2 bg-white text-black text-[13px] font-semibold rounded-full hover:bg-zinc-200 transition-colors"
              >
                Sign in
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* Subtle radial glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-white/[0.02] blur-[120px] rounded-full" />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-6 py-24">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
          className="text-center mb-20"
        >
          <p className="text-[11px] tracking-[0.3em] uppercase text-white/25 mb-6">
            Pricing
          </p>
          <h1 className="text-4xl font-light tracking-tight text-white mb-4">
            Simple, transparent pricing
          </h1>
          <p className="text-white/35 text-base font-light max-w-md mx-auto leading-relaxed">
            One codebase. Many agents. Zero collisions.
          </p>
        </motion.div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mb-10 p-4 border border-white/[0.07] text-white/40 rounded-xl flex items-center justify-center gap-3 text-sm"
            >
              <div className="w-1 h-1 rounded-full bg-red-500/60" />
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(() => {
            const isIndia = country === "IN";
            const config = isIndia ? PRICING_CONFIG.IN : PRICING_CONFIG.GLOBAL;
            const symbol = config.symbol;

            return (
              <>
                <PlanCard
                  index={0}
                  name="Hobby"
                  price="Free"
                  description="For individuals exploring multi-agent coordination."
                  features={[
                    "3 workspaces",
                    "3 concurrent agents",
                    "MCP tools included",
                    "Community support",
                  ]}
                  buttonText="Get started free"
                  current={currentPlan === "hobby"}
                  onSelect={() => handleUpgrade("hobby")}
                />

                <PlanCard
                  index={1}
                  name="Pro"
                  price={`${symbol}${config.pro.price}`}
                  originalPrice={`${symbol}${config.pro.original}`}
                  period="/mo"
                  periodNote={config.pro.note}
                  isPopular
                  description="For developers running real multi-agent workflows."
                  features={[
                    "Unlimited workspaces",
                    "10 concurrent agents",
                    "Workspace history",
                    "Priority email support",
                    "Full API access",
                  ]}
                  buttonText={
                    currentPlan === "pro" ? "Current plan" : config.pro.button
                  }
                  onSelect={() => handleUpgrade("pro")}
                  isLoading={loadingPlan === "pro"}
                  current={currentPlan === "pro"}
                />

                <PlanCard
                  index={2}
                  name="Team"
                  price={`${symbol}${config.team.price}`}
                  originalPrice={`${symbol}${config.team.original}`}
                  period="/mo"
                  periodNote={config.team.note}
                  description="For teams running agents across shared codebases."
                  features={[
                    "Unlimited workspaces",
                    "Unlimited concurrent agents",
                    "Up to 5 members",
                    "Audit log & admin controls",
                    "Priority support",
                  ]}
                  buttonText={
                    currentPlan === "team" ? "Current plan" : "Upgrade to Team"
                  }
                  onSelect={() => handleUpgrade("team")}
                  isLoading={loadingPlan === "team"}
                  current={currentPlan === "team"}
                />
              </>
            );
          })()}
        </div>

        {/* Footer note */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="text-center text-white/20 text-xs font-light mt-12 leading-relaxed"
        >
          No hidden fees — cancel before renewal and you won't be charged again.
        </motion.p>
      </div>
    </div>
  );
}
