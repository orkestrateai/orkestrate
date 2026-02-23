import { Button } from "@/components/ui/button";
import HeroIllustration from "@/components/HeroIllustration";

export function HeroSection() {
    return (
        <section className="relative min-h-screen flex items-center overflow-hidden pt-20">
            {/* SVG Hero — positioned as background, bleeding right */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <HeroIllustration />
                {/* Gradient overlay so text stays readable */}
                <div className="absolute inset-0 bg-gradient-to-r from-black via-black/70 to-transparent" />
            </div>

            <div className="relative z-10 w-full max-w-7xl mx-auto px-6 md:px-12 py-24 md:py-32">
                <div className="max-w-xl">
                    <p className="text-sm font-medium tracking-widest uppercase text-muted-foreground mb-6 flex items-center gap-2.5">
                        <span className="w-2 h-2 rounded-full bg-[#34d399] shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
                        MCP Server
                    </p>
                    <h1 className="text-5xl sm:text-6xl lg:text-7xl font-semibold tracking-tight leading-[1.08] mb-6">
                        Shared MCP for
                        <br />
                        <span className="text-[#34d399]">Collaborative</span>
                        <br />
                        Agents
                    </h1>
                    <p className="text-lg text-muted-foreground leading-relaxed max-w-md mb-10">
                        Connect once and empower all your agents with synchronized workspace state. A streamable HTTP MCP endpoint backed by Supabase.
                    </p>
                    <div className="flex flex-wrap gap-3">
                        <Button
                            size="lg"
                            className="bg-[#34d399] hover:bg-[#2cc48a] text-black font-semibold h-12 px-7 text-sm"
                            onClick={() => document.getElementById("setup")?.scrollIntoView({ behavior: "smooth" })}
                        >
                            Get Started
                        </Button>
                    </div>
                </div>
            </div>

            {/* Scroll hint */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 text-muted-foreground flex flex-col items-center gap-1.5 text-xs tracking-wide animate-pulse">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M12 5v14M19 12l-7 7-7-7" />
                </svg>
            </div>
        </section>
    );
}
