import { AlertTriangle, Info, Lightbulb } from "lucide-react";

const STYLES = {
  note: { icon: Info, border: "border-default", bg: "bg-card" },
  tip: { icon: Lightbulb, border: "border-amber-500/30", bg: "bg-amber-500/5" },
  warning: { icon: AlertTriangle, border: "border-amber-600/40", bg: "bg-amber-600/5" },
} as const;

export default function Callout({
  kind = "note",
  title,
  children,
}: {
  kind?: keyof typeof STYLES;
  title?: string;
  children: React.ReactNode;
}) {
  const { icon: Icon, border, bg } = STYLES[kind];
  return (
    <aside
      className={`my-6 flex gap-3 rounded-lg border px-4 py-3 text-[14px] leading-relaxed ${border} ${bg}`}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
      <div>
        {title && <p className="mb-1 font-medium text-[var(--foreground)]">{title}</p>}
        <div className="text-muted">{children}</div>
      </div>
    </aside>
  );
}