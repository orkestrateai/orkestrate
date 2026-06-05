"use client";

import { useEffect, useMemo, useState } from "react";

type Message = {
  info?: {
    tokens?: { input: number; output: number };
    cost?: number;
  };
};

type ContextData = {
  active: boolean;
  goal: string | null;
  files: Record<string, string> | null;
  messages: Message[];
  totals?: { tokens: number; cost: number } | null;
  state?: {
    activeMs?: number;
    activeSince?: string;
  } | null;
};

function compact(text: string, max = 260) {
  const cleaned = text
    .replaceAll("\u00e2\u0080\u0094", "-")
    .replaceAll("\u00e2\u0080\u0093", "-")
    .replaceAll("\u00e2\u0080\u0099", "'")
    .replaceAll("\u00e2\u0080\u009c", '"')
    .replaceAll("\u00e2\u0080\u009d", '"')
    .replaceAll("\u00e2\u0086\u0092", "->")
    .replace(/^#+\s*/gm, "")
    .replace(/\*\*/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return cleaned.length > max ? `${cleaned.slice(0, max - 3)}...` : cleaned;
}

function useContextData() {
  const [data, setData] = useState<ContextData | null>(null);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch("/api/context", { cache: "no-store" });
        if (!response.ok) return;
        const next = (await response.json()) as ContextData;
        if (!cancelled) setData(next);
      } catch {
        /* keep previous state */
      }
    }
    load();
    const interval = setInterval(load, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);
  return data;
}

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [active]);
  return now;
}

function formatTokens(n: number): string {
  if (n === 0) return "0";
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  return `${(n / 1_000).toFixed(1)}k`;
}

function totals(messages: Message[], cumulative?: { tokens: number; cost: number } | null) {
  const tokens = cumulative?.tokens ?? messages.reduce((sum, message) => {
    const usage = message.info?.tokens;
    return sum + (usage?.input ?? 0) + (usage?.output ?? 0);
  }, 0);
  const cost = cumulative?.cost ?? messages.reduce((sum, message) => sum + (message.info?.cost ?? 0), 0);
  return {
    tokens: formatTokens(tokens),
    cost: cost > 0 ? (cost < 0.01 ? "<$0.01" : `$${cost.toFixed(2)}`) : "$0.00",
  };
}

function formatDuration(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const units = [
    ["y", 365 * 24 * 60 * 60],
    ["mo", 30 * 24 * 60 * 60],
    ["w", 7 * 24 * 60 * 60],
    ["d", 24 * 60 * 60],
    ["h", 60 * 60],
    ["m", 60],
    ["s", 1],
  ] as const;
  let remaining = totalSeconds;
  const parts: string[] = [];
  for (const [label, seconds] of units) {
    const value = Math.floor(remaining / seconds);
    if (value === 0 && parts.length === 0 && label !== "s") continue;
    if (value > 0 || label === "s") {
      parts.push(`${value}${label}`);
      remaining -= value * seconds;
    }
    if (parts.length === 2) break;
  }
  return parts.join(" ");
}

function runUptime(data: ContextData | null, now: number) {
  const activeMs = data?.state?.activeMs ?? 0;
  const activeSince = data?.state?.activeSince;
  if (!data?.active || !activeSince) return activeMs;
  const started = Date.parse(activeSince);
  if (!Number.isFinite(started)) return activeMs;
  return activeMs + Math.max(0, now - started);
}

function countSections(markdown: string) {
  return (markdown.match(/^##\s+/gm) ?? []).length;
}

function countSentEntries(markdown: string) {
  const sections = markdown.split(/\n(?=## )/).filter(Boolean);
  return sections.filter((s) =>
    /^[*\s]*Status[*\s]*:[*\s]*(sent|scheduled)\b/im.test(s),
  ).length;
}

function latestSection(markdown: string) {
  const sections = markdown
    .split(/\n(?=## )/)
    .map((section) => section.trim())
    .filter(Boolean);
  return sections.at(-1) ?? markdown;
}

function goalSummary(goal: string | null) {
  if (!goal) return "";
  const first = goal
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith("#"));
  return compact(first ?? "", 180);
}

function field(markdown: string, name: string) {
  const match = markdown.match(
    new RegExp(`^[\\*\\s]*${name}[\\*\\s]*:[\\*\\s]*(.+?)[\\*\\s]*$`, "im"),
  );
  return compact(match?.[1] ?? "", 220);
}

function latestCandidate(files: Record<string, string>) {
  const sourceName = files["INVESTORS.md"]
    ? "INVESTORS.md"
    : files["TARGETS.md"]
      ? "TARGETS.md"
      : "";
  if (!sourceName) return null;
  const section = latestSection(files[sourceName] ?? "");
  const name = section.match(/^##\s+(.+)$/m)?.[1]?.trim() ?? "";
  if (!name) return null;
  const role = field(section, "Role");
  const fit = field(section, "Fit");
  const why = compact(
    section.match(/### Why this person\s+([\s\S]*?)(?:\n### |\s*$)/i)?.[1]?.trim() ??
      section.match(/Why this person:\s*(.+)/i)?.[1] ??
      section,
    300,
  );
  return { name, role, fit, why, sourceName };
}

function latestOrkyReview(markdown: string) {
  if (!markdown) return null;
  const section = latestSection(markdown);
  const title = section.match(/^##\s+(.+)$/m)?.[1]?.trim() ?? "Orky review";
  const status = field(section, "Status") || "review";
  const action = field(section, "Action");
  const safety = field(section, "Safety");
  const reason = field(section, "Reason") || compact(section, 260);
  const intervention = field(section, "Intervention") || field(section, "Required fix");
  return { title, status, action, safety, reason, intervention };
}

function reviewReady(markdown: string) {
  const review = latestSection(markdown);
  if (!review) return false;
  const scoreMatch = review.match(/\bscore\s*:\s*(\d+(?:\.\d+)?)\s*\/\s*10\b/i);
  const score = scoreMatch ? Number(scoreMatch[1]) : null;
  return (
    /\bstatus\s*:\s*approved\b/i.test(review) &&
    score !== null &&
    score >= 8.5 &&
    /\bsafety\s*:\s*clear\b/i.test(review) &&
    /\bflags\s*:\s*(none|clear)\b/i.test(review)
  );
}

function contactVerified(markdown: string) {
  const latest = latestSection(markdown);
  return /\bstatus\s*:\s*verified\b/i.test(latest) && /\bsource url\s*:\s*https?:\/\//i.test(latest);
}

function preSendApproved(markdown: string) {
  const latest = latestSection(markdown);
  const title = latest.match(/^##\s+(.+)$/m)?.[1] ?? "";
  const isPreSend = /\b(pre[-_]send|LLM Review)\b/i.test(title);
  return (
    isPreSend &&
    /\bstatus\s*:\s*approved\b/i.test(latest) &&
    /\baction\s*:\s*allow\b/i.test(latest) &&
    /\bsafety\s*:\s*clear\b/i.test(latest)
  );
}

function latestSent(markdown: string) {
  if (!markdown) return null;
  const section = latestSection(markdown);
  const name = section.match(/^##\s+(.+)$/m)?.[1]?.replace(/\s+-\s+\d{4}-\d{2}-\d{2}.*/, "").trim() ?? "";
  if (!name) return null;
  const to = field(section, "To");
  const subject = field(section, "Subject");
  const status = field(section, "Status");
  return { name, to, subject, status };
}

function gateItems(files: Record<string, string>) {
  const mailSection = latestSection(files["MAIL_REVIEW.md"] ?? "");
  const targetName = mailSection.match(/^##\s+(.+?)\s+-\s+\d{4}/)?.[1]?.trim();

  const contactMarkdown = files["CONTACTS.md"] ?? "";
  const contactSections = contactMarkdown.split(/\n(?=## )/).filter(Boolean);
  const contactSection = targetName
    ? contactSections.find((s) => {
        const t = s.match(/^##\s+(.+)$/m)?.[1]?.trim();
        return t?.toLowerCase() === targetName.toLowerCase();
      }) ?? contactSections.at(-1)
    : contactSections.at(-1);

  const email = field(contactSection ?? "", "Email");
  const contact = contactVerified(contactSection ?? "");
  const mail = reviewReady(files["MAIL_REVIEW.md"] ?? "");
  const orky = preSendApproved(files["ORKY_REVIEW.md"] ?? "");
  return [
    {
      label: "Contact verified",
      detail: email || "public source required",
      ok: contact,
    },
    {
      label: "Draft approved",
      detail: mail ? "rubric checks passed" : "mail review pending",
      ok: mail,
    },
    {
      label: "Orky pre-send",
      detail: orky ? "final gate passed" : "final review before sending",
      ok: orky,
    },
  ];
}

function RunObjective({ goal }: { goal: string | null }) {
  const summary = goalSummary(goal);
  if (!summary) return null;
  return (
    <section className="mb-6 pb-6 border-b border-black/10" aria-label="Run objective">
      <div className="flex items-baseline justify-between gap-4 mb-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-black/50">Current Objective</h2>
        <span className="text-xs text-black/50">live goal</span>
      </div>
      <p className="text-sm text-black/80 leading-relaxed">{summary}</p>
    </section>
  );
}

function Metrics({
  messages,
  files,
  uptimeMs,
  totals: cumulative,
}: {
  messages: Message[];
  files: Record<string, string>;
  uptimeMs: number;
  totals?: { tokens: number; cost: number } | null;
}) {
  const run = totals(messages, cumulative);
  const draftCount = countSections(files["OUTREACH.md"] ?? "");
  const reviewCount = countSections(files["MAIL_REVIEW.md"] ?? "");
  const sentCount = countSentEntries(files["SENT.md"] ?? "");
  const metrics = [
    { label: "uptime", value: formatDuration(uptimeMs) },
    { label: "tokens", value: run.tokens },
    { label: "cost", value: run.cost },
    { label: "sent", value: sentCount.toString() },
    { label: "drafts", value: draftCount.toString() },
    { label: "reviews", value: reviewCount.toString() },
  ];
  return (
    <section className="mb-6 pb-6 border-b border-black/10" aria-label="Run metrics">
      <div className="grid grid-cols-6 gap-4">
        {metrics.map((metric) => (
          <div key={metric.label} className="min-w-0">
            <span className="block text-xs uppercase tracking-wider text-black/50">{metric.label}</span>
            <strong className="block mt-2 text-xl font-normal text-black/90 whitespace-nowrap">{metric.value}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function SentPreview({ files }: { files: Record<string, string> }) {
  const sent = latestSent(files["SENT.md"] ?? "");
  const sentCount = countSentEntries(files["SENT.md"] ?? "");
  if (!sent && sentCount === 0) return null;
  return (
    <section className="mb-6 pb-6 border-b border-black/10" aria-label="Outreach sent">
      <div className="flex items-baseline justify-between gap-4 mb-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-black/50">Outreach Sent</h2>
        <span className="text-xs text-black/50">{sentCount} total</span>
      </div>
      {sent && (
        <p className="text-sm text-black/80">
          <span className="text-green-600 text-lg mr-2">↗</span>
          <strong>{sent.name}</strong>
          {`, ${sentCount} emails total.`}
        </p>
      )}
    </section>
  );
}

function CandidatePreview({ files }: { files: Record<string, string> }) {
  const candidate = latestCandidate(files);
  if (!candidate) return null;
  return (
    <section className="mb-6 pb-6 border-b border-black/10" aria-label="Current candidate">
      <div className="flex items-baseline justify-between gap-4 mb-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-black/50">Target Under Review</h2>
        <span className="text-xs text-black/50">{candidate.sourceName}</span>
      </div>
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-black/10 flex items-center justify-center text-sm shrink-0">👤</div>
        <div>
          <p className="text-sm font-semibold text-black/90">{candidate.name}</p>
          <p className="text-sm text-black/70 mt-1">{candidate.role}{candidate.fit ? ` (${candidate.fit})` : ""}</p>
        </div>
      </div>
    </section>
  );
}

function OrkyReviewPreview({ files }: { files: Record<string, string> }) {
  const review = latestOrkyReview(files["ORKY_REVIEW.md"] ?? "");
  if (!review) return null;
  const aligned = /^approved\b/i.test(review.status);
  const intervened = /^intervene/i.test(review.status) || (review.intervention && !/^none$/i.test(review.intervention));
  const statusColor = aligned ? "bg-green-50 text-green-700 border-green-200" : intervened ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-red-50 text-red-700 border-red-200";
  const statusText = intervened ? "intervened" : aligned ? "approved" : "blocked";

  return (
    <section className="mb-6 pb-6 border-b border-black/10" aria-label="Latest Orky review">
      <div className="flex items-center justify-between gap-4 mb-2">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-black/50">Orky Review</h2>
        <span className={`text-xs px-3 py-1 rounded-full border ${statusColor}`}>{statusText}</span>
      </div>
      <p className="text-sm text-black/70 leading-relaxed line-clamp-2">{review.reason}</p>
    </section>
  );
}

function SendGate({ files }: { files: Record<string, string> }) {
  if (!files["CONTACTS.md"] && !files["MAIL_REVIEW.md"] && !files["ORKY_REVIEW.md"]) return null;
  const gates = gateItems(files);
  const ready = gates.every((gate) => gate.ok);
  return (
    <section className="mb-6 pb-6 border-b border-black/10" aria-label="Send gate">
      <div className="flex items-baseline justify-between gap-4 mb-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-black/50">Send Gate</h2>
        <span className={`text-xs ${ready ? "text-green-600" : "text-amber-600"}`}>{ready ? "ready" : "blocked"}</span>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {gates.map((gate) => (
          <div key={gate.label} className="flex items-start gap-2">
            <span className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs border ${gate.ok ? "border-green-600 text-green-600" : "border-amber-500 text-amber-500"}`}>
              {gate.ok ? "✓" : "◷"}
            </span>
            <div>
              <strong className="text-sm font-medium text-black/90 block">{gate.label}</strong>
              <small className="text-xs text-black/60 block mt-0.5">{gate.detail}</small>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function ProofPanel() {
  const data = useContextData();
  const files = useMemo(() => data?.files ?? {}, [data?.files]);
  const messages = useMemo(() => data?.messages ?? [], [data?.messages]);
  const now = useNow(Boolean(data?.active));
  const uptimeMs = useMemo(() => runUptime(data, now), [data, now]);

  return (
    <aside
      className="fixed z-10 top-[68px] right-0 bottom-0 w-[min(34vw,620px)] overflow-auto py-6 px-8 text-sm leading-relaxed text-black/80"
      style={{ fontFamily: "var(--font-sans, sans-serif)", background: "var(--orky-bg)", scrollbarWidth: "none" }}
      aria-label="Agent proof of work"
    >
      <RunObjective goal={data?.goal ?? null} />
      <Metrics messages={messages} files={files} uptimeMs={uptimeMs} totals={data?.totals} />
      <SentPreview files={files} />
      <CandidatePreview files={files} />
      <OrkyReviewPreview files={files} />
      <SendGate files={files} />
    </aside>
  );
}
