"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

export default function CodeBlockClient({
  code,
  darkHtml,
  lightHtml,
  filename,
}: {
  code: string;
  darkHtml: string;
  lightHtml: string;
  filename?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="doc-code-block my-6 overflow-hidden rounded-xl border border-default bg-[var(--code-bg)]">
      <div className="flex items-center justify-between border-b border-default px-4 py-2">
        <span className="font-mono text-[11px] text-muted">{filename ?? " "}</span>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] text-muted transition-colors hover:bg-card hover:text-[var(--foreground)]"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5" /> Copied
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" /> Copy
            </>
          )}
        </button>
      </div>
      <div
        className="hidden text-[13px] leading-[1.6] dark:block [&>pre]:overflow-x-auto [&>pre]:bg-transparent [&>pre]:p-4"
        dangerouslySetInnerHTML={{ __html: darkHtml }}
      />
      <div
        className="block text-[13px] leading-[1.6] dark:hidden [&>pre]:overflow-x-auto [&>pre]:bg-transparent [&>pre]:p-4"
        dangerouslySetInnerHTML={{ __html: lightHtml }}
      />
    </div>
  );
}