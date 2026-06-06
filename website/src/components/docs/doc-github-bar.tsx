"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GitBranch } from "lucide-react";
import {
  contributingUrl,
  docsBlobUrl,
  docsEditUrl,
  docsIssuesUrl,
  docsTreeUrl,
} from "@/lib/docs-github";

function BarLink({
  href,
  children,
  external,
}: {
  href: string;
  children: React.ReactNode;
  external?: boolean;
}) {
  const className =
    "font-medium text-[var(--foreground)] underline decoration-[var(--border)] underline-offset-2 hover:decoration-[var(--foreground)]";
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

export default function DocGithubBar() {
  const pathname = usePathname();
  const editUrl = docsEditUrl(pathname);
  const blobUrl = docsBlobUrl(pathname);

  return (
    <aside className="mb-8 rounded-lg border border-default bg-card px-4 py-3 text-[13px] leading-relaxed text-muted">
      <div className="flex flex-wrap items-start gap-2">
        <GitBranch className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />
        <p className="min-w-0 flex-1">
          <span className="font-medium text-[var(--foreground)]">Docs are a work in progress.</span> We are
          expanding pages and aligning them with the shipped CLI — gaps and rough edges are expected.{" "}
          <BarLink href="/docs#contribute">Help improve them</BarLink> on GitHub.
        </p>
      </div>
      <p className="mt-2 pl-6 text-[12px]">
        {editUrl && blobUrl ? (
          <>
            <BarLink href={editUrl} external>
              Edit this page
            </BarLink>
            {" · "}
            <BarLink href={blobUrl} external>
              View source
            </BarLink>
            {" · "}
          </>
        ) : null}
        <BarLink href={docsTreeUrl} external>
          All docs
        </BarLink>
        {" · "}
        <BarLink href={docsIssuesUrl} external>
          Report issue
        </BarLink>
        {" · "}
        <BarLink href={contributingUrl} external>
          Contributing
        </BarLink>
      </p>
    </aside>
  );
}