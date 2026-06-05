import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getDocNeighbors } from "@/lib/docs-nav";

export default function DocPrevNext({ href }: { href: string }) {
  const { prev, next } = getDocNeighbors(href);
  if (!prev && !next) return null;

  return (
    <nav className="mt-16 grid gap-4 border-t border-default pt-8 sm:grid-cols-2">
      {prev ? (
        <Link
          href={prev.href}
          className="group flex flex-col rounded-xl border border-default bg-card p-4 transition-colors hover:bg-[var(--card-hover)]"
        >
          <span className="flex items-center gap-1 text-[12px] text-muted">
            <ChevronLeft className="h-3.5 w-3.5" /> Previous
          </span>
          <span className="mt-1 font-medium text-[var(--foreground)] group-hover:opacity-80">
            {prev.title}
          </span>
        </Link>
      ) : (
        <div />
      )}
      {next ? (
        <Link
          href={next.href}
          className="group flex flex-col items-end rounded-xl border border-default bg-card p-4 text-right transition-colors hover:bg-[var(--card-hover)] sm:col-start-2"
        >
          <span className="flex items-center gap-1 text-[12px] text-muted">
            Next <ChevronRight className="h-3.5 w-3.5" />
          </span>
          <span className="mt-1 font-medium text-[var(--foreground)] group-hover:opacity-80">
            {next.title}
          </span>
        </Link>
      ) : null}
    </nav>
  );
}