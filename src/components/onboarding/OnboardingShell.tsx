"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";

type OnboardingShellProps = {
  title: string;
  subtitle: string;
  stepIndex: number;
  totalSteps: number;
  children: ReactNode;
  footer?: ReactNode;
  logo?: ReactNode;
  className?: string;
  onStepClick?: (index: number) => void;
};

export function OnboardingShell({
  title,
  subtitle,
  stepIndex,
  totalSteps,
  children,
  footer,
  logo,
  className,
  onStepClick,
}: OnboardingShellProps) {
  return (
    <div className="min-h-screen w-full bg-[#030303] text-[#EAEAEA] relative overflow-hidden flex flex-col items-center justify-center">
      {/* Background radial gradient for premium look */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-1/2 h-[600px] w-[800px] -translate-x-1/2 rounded-full bg-white/[0.03] blur-[140px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.02),transparent_70%)]" />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-2xl flex-col items-center px-6 py-8 text-center sm:py-12">
        {/* Logo at the very top */}
        {logo && <div className="mb-6">{logo}</div>}

        {/* Title and Subtitle */}
        <div className="mb-8 flex flex-col items-center sm:mb-10">
          <h1 className="text-[32px] leading-[1.1] font-semibold tracking-[-0.03em] text-white sm:text-[40px]">
            {title}
          </h1>
          <p className="mt-3 max-w-[460px] text-[15px] sm:text-[17px] text-zinc-500 font-medium leading-relaxed">
            {subtitle}
          </p>
        </div>

        {/* Dynamic Step Content */}
        <div className={cn("w-full transition-all duration-300", className)}>
          {children}
        </div>

        {/* Footer info (Step counter etc) */}
        {footer ? (
          <div className="mt-8 w-full max-w-xs">{footer}</div>
        ) : null}

        {/* Progress Dots */}
        <div className="mt-8 flex items-center gap-3 sm:mt-10">
          {Array.from({ length: totalSteps }).map((_, index) => {
            const active = index === stepIndex;
            const complete = index < stepIndex;
            return (
              <button
                key={index}
                type="button"
                onClick={() => onStepClick?.(index)}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  active && "w-8 bg-zinc-400",
                  complete && "w-1.5 bg-zinc-600 hover:bg-zinc-500 cursor-pointer",
                  !active && !complete && "w-1.5 bg-zinc-800/80 hover:bg-zinc-700/80 cursor-pointer",
                )}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
