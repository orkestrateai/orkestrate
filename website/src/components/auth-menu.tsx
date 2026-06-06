"use client";

import Link from "next/link";
import { ChevronDown, LogOut, PackagePlus, BookOpen } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";

type AuthUser = {
  email: string | null;
  githubHandle: string | null;
  name: string | null;
  avatarUrl: string | null;
  displayName: string;
  subtitle: string | null;
};

function initials(user: AuthUser) {
  const source = user.displayName || user.githubHandle || user.email || "?";
  const parts = source.replace(/^@/, "").split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

function UserAvatar({ user, size = 32 }: { user: AuthUser; size?: number }) {
  const [failed, setFailed] = useState(false);

  if (user.avatarUrl && !failed) {
    return (
      <img
        src={user.avatarUrl}
        alt=""
        width={size}
        height={size}
        onError={() => setFailed(true)}
        className="h-full w-full rounded-full object-cover"
      />
    );
  }

  return (
    <span className="flex h-full w-full items-center justify-center rounded-full bg-[var(--accent)] text-[11px] font-semibold text-[var(--accent-foreground)]">
      {initials(user)}
    </span>
  );
}

function MenuLink({
  href,
  icon: Icon,
  children,
  onSelect,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  onSelect: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onSelect}
      className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] text-[var(--foreground)] transition-colors hover:bg-[var(--card-hover)]"
    >
      <Icon className="h-4 w-4 shrink-0 text-muted" />
      {children}
    </Link>
  );
}

export default function AuthMenu() {
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    let cancelled = false;

    fetch("/api/auth/me", { credentials: "same-origin" })
      .then((res) => res.json())
      .then((data: { user: AuthUser | null }) => {
        if (!cancelled) setUser(data.user);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);

  if (user === undefined) {
    return (
      <div
        className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-card ring-1 ring-[var(--ring)]"
        aria-hidden
      />
    );
  }

  if (!user) {
    return (
      <Link
        href="/auth/github"
        className="inline-flex h-8 items-center rounded-full border border-default px-3.5 text-[13px] font-medium text-[var(--foreground)] transition-colors hover:bg-card"
      >
        Sign in
      </Link>
    );
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        className="flex items-center gap-1.5 rounded-full py-0.5 pl-0.5 pr-2 transition-colors hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
      >
        <span className="h-8 w-8 shrink-0 overflow-hidden rounded-full ring-1 ring-[var(--ring)]">
          <UserAvatar user={user} />
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-muted transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
        <span className="sr-only">Account menu for {user.displayName}</span>
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-60 origin-top-right rounded-xl border border-default bg-[var(--background)] p-1.5 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.35)]"
        >
          <div className="flex items-center gap-3 px-2.5 py-2.5">
            <span className="h-9 w-9 shrink-0 overflow-hidden rounded-full ring-1 ring-[var(--ring)]">
              <UserAvatar user={user} size={36} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-[var(--foreground)]">{user.displayName}</p>
              {user.subtitle && (
                <p className="truncate text-[12px] text-muted">{user.subtitle}</p>
              )}
            </div>
          </div>

          <div className="my-1 h-px bg-[var(--border)]" role="separator" />

          <MenuLink href="/submit" icon={PackagePlus} onSelect={close}>
            Submit a pack
          </MenuLink>
          <MenuLink href="/docs/publisher" icon={BookOpen} onSelect={close}>
            Publisher guide
          </MenuLink>

          <div className="my-1 h-px bg-[var(--border)]" role="separator" />

          <form action="/auth/signout" method="post" role="none">
            <button
              type="submit"
              role="menuitem"
              className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] text-[var(--foreground)] transition-colors hover:bg-[var(--card-hover)] cursor-pointer"
            >
              <LogOut className="h-4 w-4 shrink-0 text-muted" />
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}