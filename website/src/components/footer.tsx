import Link from "next/link";
import Mark from "@/components/mark";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { label: "Registry", href: "/registry" },
      { label: "Publish", href: "/submit" },
      { label: "Changelog", href: "/changelog" },
    ],
  },
  {
    title: "Docs",
    links: [
      { label: "Overview", href: "/docs" },
      { label: "Quickstart", href: "/docs/getting-started/quickstart" },
      { label: "CLI reference", href: "/docs/reference/cli" },
      { label: "Contribute", href: "/docs#contribute" },
    ],
  },
  {
    title: "Help",
    links: [
      { label: "Troubleshooting", href: "/docs/help/troubleshooting" },
      { label: "Common issues", href: "/docs/help/common-issues" },
      { label: "Resources", href: "/resources" },
    ],
  },
  {
    title: "Agents",
    links: [
      { label: "llms.txt", href: "/llms.txt" },
      { label: "agents.md", href: "/agents.md" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy", href: "/privacy" },
      { label: "Security", href: "/security" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="border-t border-default bg-surface">
      <div className="mx-auto max-w-[1120px] px-6 py-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-6">
          <div className="lg:col-span-1">
            <div className="flex items-center gap-2.5">
              <Mark className="h-6 w-6" />
              <span className="text-[13px] font-medium text-[var(--foreground)]">Orkestrate</span>
            </div>
            <p className="mt-3 text-[12px] leading-relaxed text-muted">
              Browse, use, and share specialized harnesses.
            </p>
          </div>
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h3 className="text-[12px] font-semibold uppercase tracking-[0.1em] text-muted">
                {col.title}
              </h3>
              <ul className="mt-3 space-y-2">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-[13px] text-muted transition-colors hover:text-[var(--foreground)]"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-10 border-t border-default pt-6 text-[12px] text-muted">
          © {new Date().getFullYear()} Orkestrate. Open source.
        </p>
      </div>
    </footer>
  );
}