import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function DocCard({
  title,
  description,
  href,
}: {
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col rounded-xl border border-default bg-card p-5 transition-colors hover:bg-[var(--card-hover)]"
    >
      <h3 className="flex items-center justify-between text-[15px] font-semibold text-[var(--foreground)]">
        {title}
        <ArrowRight className="h-4 w-4 text-muted opacity-0 transition-opacity group-hover:opacity-100" />
      </h3>
      <p className="mt-2 flex-1 text-[13px] leading-relaxed text-muted">{description}</p>
    </Link>
  );
}