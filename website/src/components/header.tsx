"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Mark from "@/components/mark";
import ThemeToggle from "@/components/theme-toggle";

const NAV = [
  { name: "Docs", href: "/docs" },
  { name: "Registry", href: "/registry" },
];

export default function Header() {
  const pathname = usePathname();

  return (
    <header
      className="sticky top-0 z-50 border-b border-default backdrop-blur-md"
      style={{ background: "var(--header-bg)" }}
    >
      <div className="mx-auto flex h-14 max-w-[1280px] items-center justify-between gap-6 px-6">
        <Link
          href="/"
          className="flex items-center gap-3 shrink-0 rounded-lg py-1 pr-2 transition-opacity hover:opacity-90"
        >
          <Mark withPlate className="h-8 w-8" />
          <span className="text-[15px] font-semibold tracking-[-0.02em] text-[var(--foreground)]">
            Orkestrate
          </span>
        </Link>

        <nav className="hidden items-center gap-7 md:flex">
          {NAV.map((link) => {
            const active =
              link.href === "/"
                ? pathname === "/"
                : pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`text-[14px] font-medium transition-colors ${
                  active ? "text-[var(--foreground)]" : "text-muted hover:text-[var(--foreground)]"
                }`}
              >
                {link.name}
              </Link>
            );
          })}
          <a
            href="https://github.com/system1970/Orkestrate"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[14px] font-medium text-muted transition-colors hover:text-[var(--foreground)]"
          >
            GitHub
          </a>
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link
            href="/docs/getting-started/quickstart"
            className="hidden sm:inline-flex h-8 items-center rounded-full bg-[var(--foreground)] px-4 text-[13px] font-medium text-[var(--background)] transition-opacity hover:opacity-90"
          >
            Get started
          </Link>
        </div>
      </div>
    </header>
  );
}