"use client";

import { Check } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";

const INSTALL = {
  unix: "curl -fsSL https://orkestrate.space/cli/install.sh | bash",
  windows: "irm https://orkestrate.space/cli/install.ps1 | iex",
} as const;

type Platform = keyof typeof INSTALL;

const TABS: { key: Platform; label: string }[] = [
  { key: "unix", label: "macOS / Linux" },
  { key: "windows", label: "Windows" },
];

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "unix";
  if (/Windows/i.test(navigator.userAgent)) return "windows";
  return "unix";
}

function CommandLine({ platform }: { platform: Platform }) {
  if (platform === "unix") {
    return (
      <>
        <span className="text-muted">curl -fsSL </span>
        <span className="text-[var(--foreground)]">https://orkestrate.space/cli/install.sh</span>
        <span className="text-muted"> | bash</span>
      </>
    );
  }
  return (
    <>
      <span className="text-muted">irm </span>
      <span className="text-[var(--foreground)]">https://orkestrate.space/cli/install.ps1</span>
      <span className="text-muted"> | iex</span>
    </>
  );
}

export default function HeroInstall() {
  const [platform, setPlatform] = useState<Platform>("unix");
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tablistId = useId();

  useEffect(() => {
    setPlatform(detectPlatform());
  }, []);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(INSTALL[platform]);
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 2200);
    } catch {
      /* ignore */
    }
  }, [platform]);

  useEffect(() => {
    return () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    };
  }, []);

  return (
    <div className="mx-auto mt-10 w-full max-w-[620px] text-left">
      <div className="overflow-hidden rounded-2xl border border-default bg-card shadow-[0_12px_40px_-16px_rgba(0,0,0,0.18)] dark:shadow-[0_12px_48px_-16px_rgba(0,0,0,0.65)]">
        <div className="flex items-center justify-between gap-3 border-b border-default px-3 py-2">
          <div
            role="tablist"
            aria-label="Install platform"
            id={tablistId}
            className="inline-flex rounded-lg bg-[var(--install-bg)] p-0.5"
          >
            {TABS.map(({ key, label }) => {
              const selected = platform === key;
              return (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setPlatform(key)}
                  className={`rounded-md px-3 py-1.5 text-[12px] font-medium transition-all ${
                    selected
                      ? "bg-[var(--background)] text-[var(--foreground)] shadow-sm"
                      : "text-muted hover:text-[var(--foreground)]"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => void copy()}
            className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-[12px] font-medium transition-all ${
              copied
                ? "border-[var(--foreground)]/20 bg-[var(--foreground)] text-[var(--background)]"
                : "border-default bg-[var(--background)] text-[var(--foreground)] hover:bg-[var(--card-hover)]"
            }`}
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                Copied
              </>
            ) : (
              "Copy"
            )}
          </button>
        </div>

        <button
          type="button"
          onClick={() => void copy()}
          className="group flex w-full items-center px-4 py-4 text-left transition-colors hover:bg-[var(--install-bg)] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent)]/40"
          aria-label={`Copy install command for ${platform === "unix" ? "macOS and Linux" : "Windows"}`}
        >
          <code className="block w-full font-mono text-[13px] leading-[1.55] sm:text-[13.5px]">
            <CommandLine platform={platform} />
          </code>
        </button>
      </div>

      <p className="sr-only" aria-live="polite">
        {copied ? "Install command copied" : ""}
      </p>
    </div>
  );
}