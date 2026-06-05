"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

interface TocItem {
  id: string;
  text: string;
  level: number;
}

export default function TableOfContents() {
  const [items, setItems] = useState<TocItem[]>([]);
  const [activeId, setActiveId] = useState("");
  const pathname = usePathname();

  useEffect(() => {
    const timer = setTimeout(() => {
      const mainEl = document.querySelector("main");
      if (!mainEl) return;

      const headings = mainEl.querySelectorAll("h2, h3");
      const tocItems: TocItem[] = [];

      headings.forEach((heading, idx) => {
        let id = heading.id;
        if (!id) {
          id =
            heading.textContent
              ?.toLowerCase()
              .trim()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/(^-|-$)/g, "") || `heading-${idx}`;
          heading.id = id;
        }
        tocItems.push({
          id,
          text: heading.textContent || "",
          level: heading.tagName.toLowerCase() === "h3" ? 3 : 2,
        });
      });

      setItems(tocItems);
      setActiveId("");

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) setActiveId(entry.target.id);
          });
        },
        { rootMargin: "-20% 0px -60% 0px", threshold: 0 }
      );

      headings.forEach((h) => observer.observe(h));
      return () => observer.disconnect();
    }, 150);

    return () => clearTimeout(timer);
  }, [pathname]);

  if (items.length === 0) return null;

  return (
    <div>
      <h4 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">On this page</h4>
      <ul className="mt-3 space-y-1.5 text-[12px]">
        {items.map((item) => (
          <li key={item.id} style={{ paddingLeft: item.level === 3 ? 10 : 0 }}>
            <a
              href={`#${item.id}`}
              onClick={(e) => {
                e.preventDefault();
                document.getElementById(item.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
                setActiveId(item.id);
              }}
              className={`block py-0.5 transition-colors ${
                activeId === item.id
                  ? "font-medium text-[var(--foreground)]"
                  : "text-muted hover:text-[var(--foreground)]"
              }`}
            >
              {item.text}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}