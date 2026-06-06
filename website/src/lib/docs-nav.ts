export type DocLink = { title: string; href: string };

export type DocGroup = { title: string; items: DocLink[] };

export const DOC_NAV: DocGroup[] = [
  {
    title: "Get started",
    items: [
      { title: "Overview", href: "/docs" },
      { title: "Installation", href: "/docs/getting-started/installation" },
      { title: "Quickstart", href: "/docs/getting-started/quickstart" },
      { title: "Workbench (TUI)", href: "/docs/workbench" },
      { title: "Concepts", href: "/docs/concepts" },
    ],
  },
  {
    title: "Harnesses",
    items: [
      { title: "Specialized harnesses", href: "/docs/harnesses/introduction" },
      { title: "Authoring slices", href: "/docs/harnesses/authoring" },
    ],
  },
  {
    title: "Agents",
    items: [
      { title: "Agent packs", href: "/docs/agents/packs" },
      { title: "Launch & pack homes", href: "/docs/agents/launch" },
    ],
  },
  {
    title: "Registry",
    items: [
      { title: "Browse & install", href: "/docs/registry" },
      { title: "Publisher guide", href: "/docs/publisher" },
    ],
  },
  {
    title: "Reference",
    items: [{ title: "CLI", href: "/docs/reference/cli" }],
  },
  {
    title: "Help",
    items: [
      { title: "Troubleshooting", href: "/docs/help/troubleshooting" },
      { title: "Common issues", href: "/docs/help/common-issues" },
      { title: "Resources", href: "/resources" },
    ],
  },
  {
    title: "Project",
    items: [
      { title: "Contribute to docs", href: "/docs#contribute" },
      { title: "Changelog", href: "/changelog" },
      { title: "Security", href: "/security" },
      { title: "Privacy", href: "/privacy" },
    ],
  },
];

export const DOC_CARDS = [
  {
    title: "Workbench (TUI)",
    description: "OpenTUI launcher — screens, keys, welcome flow, what it is not.",
    href: "/docs/workbench",
  },
  {
    title: "Quickstart",
    description: "Install, workbench, launch OpenCode in a new terminal.",
    href: "/docs/getting-started/quickstart",
  },
  {
    title: "Specialized harnesses",
    description: "Task-specific slices — not one config for every job.",
    href: "/docs/harnesses/introduction",
  },
  {
    title: "Agent packs",
    description: "pack.yaml, harness layout, validate.",
    href: "/docs/agents/packs",
  },
  {
    title: "Registry",
    description: "List, search, install from orkestrate.space.",
    href: "/docs/registry",
  },
  {
    title: "CLI reference",
    description: "pack, run, registry, doctor.",
    href: "/docs/reference/cli",
  },
  {
    title: "Troubleshooting",
    description: "Launch, registry API, Windows.",
    href: "/docs/help/troubleshooting",
  },
];

/** Flat order for prev/next footer */
export const DOC_FLAT: DocLink[] = DOC_NAV.flatMap((g) => g.items).filter(
  (item, index, arr) => arr.findIndex((x) => x.href === item.href) === index
);

export function getDocNeighbors(href: string): { prev?: DocLink; next?: DocLink } {
  const i = DOC_FLAT.findIndex((d) => d.href === href);
  if (i < 0) return {};
  return {
    prev: i > 0 ? DOC_FLAT[i - 1] : undefined,
    next: i < DOC_FLAT.length - 1 ? DOC_FLAT[i + 1] : undefined,
  };
}