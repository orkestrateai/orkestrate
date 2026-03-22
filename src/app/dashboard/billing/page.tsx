"use client";

import React, { useState } from "react";
import { Check, Loader2, CreditCard, Sparkles, Users, Zap, ArrowLeft, ArrowRight } from "lucide-react";
import Script from "next/script";
import useSWR from "swr";
import { motion, AnimatePresence } from "motion/react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";

const fetcher = (url: string) => {
    const supabase = createSupabaseBrowserClient();
    return supabase.auth.getSession().then(({ data: { session } }: { data: { session: any } }) => {
        return fetch(url, {
            headers: { Authorization: `Bearer ${session?.access_token}` },
        }).then((res) => res.json());
    });
};

interface PlanCardProps {
    name: string;
    price: string;
    description: string;
    features: string[];
    isPopular?: boolean;
    buttonText: string;
    onSelect: () => void;
    isLoading?: boolean;
    disabled?: boolean;
    current?: boolean;
}

const PlanCard = ({ name, price, description, features, isPopular, buttonText, onSelect, isLoading, disabled, current }: PlanCardProps) => (
    <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`relative flex flex-col p-8 bg-zinc-950 border ${current ? 'border-white' : 'border-zinc-800'} rounded-2xl ${isPopular ? 'ring-1 ring-white/20' : ''}`}
    >
        {isPopular && (
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-white text-black text-[10px] font-bold uppercase tracking-widest rounded-full">
                Launch Offer
            </div>
        )}
        
        <div className="mb-8">
            <h3 className="text-xl font-medium text-white mb-2">{name}</h3>
            <div className="flex items-baseline gap-1 mb-4">
                <span className="text-4xl font-semibold text-white">{price}</span>
                {price !== "Free" && <span className="text-zinc-500 text-sm">/mo</span>}
            </div>
            <p className="text-zinc-400 text-sm leading-relaxed">{description}</p>
        </div>

        <div className="flex-1 space-y-4 mb-8">
            {features.map((feature, i) => (
                <div key={i} className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-zinc-400 mt-0.5" />
                    <span className="text-zinc-300 text-sm">{feature}</span>
                </div>
            ))}
        </div>

        <button
            onClick={onSelect}
            disabled={disabled || isLoading || current}
            className={`w-full py-3 px-4 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
                current 
                    ? 'bg-zinc-900 text-zinc-400 cursor-default border border-zinc-800' 
                    : 'bg-white text-black hover:bg-zinc-200 disabled:opacity-50'
            }`}
        >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : buttonText}
        </button>
    </motion.div>
);

export default function BillingPage() {
    const { data: subData } = useSWR("/api/payments/status", fetcher);
    const currentPlan = subData?.planType || "hobby";
    const limits = subData?.limits || { maxAgents: 3, maxMembers: 1 };

    return (
        <div className="min-h-screen bg-black text-white p-8 md:p-12">
            <div className="max-w-4xl mx-auto">
                <header className="mb-16">
                    <Link 
                        href="/dashboard/settings" 
                        className="inline-flex items-center gap-2 text-zinc-500 hover:text-white transition-colors mb-8 group"
                    >
                        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                        Back to Settings
                    </Link>
                    <div className="flex items-center gap-3 mb-4">
                        <CreditCard className="w-8 h-8 text-white" />
                        <h1 className="text-4xl font-medium tracking-tight">Billing & Plans</h1>
                    </div>
                    <p className="text-zinc-500 text-lg max-w-2xl">
                        Manage your subscription and view your current usage limits.
                    </p>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                    <div className="p-8 bg-zinc-950 border border-zinc-800 rounded-2xl">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Current Plan</div>
                        <h3 className="text-2xl font-medium text-white capitalize mb-6">{currentPlan}</h3>
                        <Link 
                            href="/pricing"
                            className="inline-flex items-center gap-2 bg-white text-black px-6 py-3 rounded-xl font-medium hover:bg-zinc-200 transition-colors"
                        >
                            Change Plan
                            <ArrowRight className="w-4 h-4" />
                        </Link>
                    </div>

                    <div className="p-8 bg-zinc-950 border border-zinc-800 rounded-2xl">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-4">Usage Limits</div>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-zinc-400">Agents</span>
                                <span className="text-white font-medium">{limits.maxAgents >= 999 ? "Unlimited" : limits.maxAgents}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-zinc-400">Members</span>
                                <span className="text-white font-medium">{limits.maxMembers >= 999 ? "Unlimited" : limits.maxMembers}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-8 bg-zinc-950 border border-zinc-800 rounded-2xl">
                    <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                        <Users className="w-5 h-5" />
                        Billing Support
                    </h3>
                    <p className="text-zinc-500 text-sm mb-6 leading-relaxed">
                        Need help with your invoice or have questions about our plans? Our support team is here to help you scaling your agentic workflows.
                    </p>
                    <button className="text-white text-sm font-medium hover:underline underline-offset-4">
                        Contact support →
                    </button>
                </div>
            </div>
        </div>
    );
}
