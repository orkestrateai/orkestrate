"use client";

import { useEffect, useMemo, useState } from "react";

type Part = {
  type: string;
  text?: string;
  tool?: string;
  state?: Record<string, unknown>;
  filename?: string;
  reason?: string;
  cost?: number;
  error?: string;
};

type Message = {
  info: {
    role: "user" | "assistant";
    time: { created: number };
    tokens?: { input: number; output: number };
    cost?: number;
  };
  parts: Part[];
};

type ContextData = {
  active: boolean;
  messages: Message[];
  files?: Record<string, string> | null;
  totals?: { tokens: number; cost: number } | null;
};

type TraceEvent = {
  tone: "blue" | "green" | "red" | "brown";
  time: string;
  title: string;
  detail: string[];
  meta?: string;
};

const fallbackEvents: TraceEvent[] = [
  {
    tone: "blue",
    time: "--:--:-- PM",
    title: "waiting for agent run",
    detail: ["start the local runner to stream real work"],
  },
];

function cleanText(text: string) {
  return text
    .replaceAll("\u00e2\u0080\u0094", "-")
    .replaceAll("\u00e2\u0080\u0093", "-")
    .replaceAll("\u00e2\u0080\u0099", "'")
    .replaceAll("\u00e2\u0080\u009c", '"')
    .replaceAll("\u00e2\u0080\u009d", '"')
    .replaceAll("\u00e2\u0086\u0092", "->")
    .replaceAll("\u00e2\u0080\u00a2", "-")
    .replace(/\*\*/g, "")
    .replace(/`/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function compact(text: string, max = 86) {
  const line = cleanText(text);
  return line.length > max ? `${line.slice(0, max - 3)}...` : line;
}

function formatTime(ms: number) {
  return new Date(ms).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

function money(cost: number) {
  return cost > 0 && cost < 0.01 ? "<$0.01" : `$${cost.toFixed(2)}`;
}

function tokenMeta(message: Message) {
  const tokens = message.info.tokens;
  const cost = message.info.cost;
  const total = (tokens?.input ?? 0) + (tokens?.output ?? 0);
  const parts: string[] = [];
  if (total > 0) parts.push(`${(total / 1000).toFixed(1)}k tokens`);
  if (cost != null && cost > 0) parts.push(money(cost));
  return parts.join(" \u00b7 ");
}

function toolFile(part: Part) {
  const input = part.state?.input as Record<string, unknown> | undefined;
  const filePath = input?.filePath as string | undefined;
  if (!filePath) return null;
  return filePath.split(/[\\/]/).at(-1) ?? filePath;
}

function summarizeTool(part: Part) {
  const status = part.state?.status;
  const tool = part.tool ?? "tool";
  const file = toolFile(part);
  if (status === "error") return file ? `${tool} blocked in ${file}` : `${tool} blocked`;
  if ((tool === "write" || tool === "edit") && status === "completed") return file ? `updated ${file}` : "updated file";
  if (tool === "websearch" && status === "completed") return "searched source";
  if (tool === "webfetch" && status === "completed") return "checked source";
  return tool;
}

function meaningfulLines(text: string) {
  return text
    .split(/\n+/)
    .map(cleanText)
    .filter(Boolean)
    .filter((line) => !/^```/.test(line))
    .filter((line) => !/^used\s+/i.test(line))
    .filter((line) => !/^ran command/i.test(line))
    .filter((line) => !/^tool result/i.test(line))
    .map((line) => compact(line, 92));
}

function titleFromText(text: string) {
  const lines = meaningfulLines(text);
  const first = lines[0];
  if (!first) return "";
  const stepWithRest = first.match(/^(step\s+\d+[^.]*\.\s+.+)$/i);
  if (stepWithRest) return compact(stepWithRest[1], 92);
  const sentence = first.match(/^(.+?[.!?])(\s|$)/)?.[1];
  if (sentence && sentence.length > 12) return compact(sentence, 92);
  return compact(first, 92);
}

function eventFromMessage(message: Message): TraceEvent | null {
  const textParts = message.parts
    .filter((part) => part.type === "text" && part.text)
    .map((part) => part.text ?? "")
    .filter(Boolean);
  const toolParts = message.parts.filter((part) => part.type === "tool");
  const publicTools = toolParts.filter((part) => {
    if (part.state?.status === "error") return true;
    return ["write", "edit", "websearch", "webfetch"].includes(part.tool ?? "");
  });
  const fileParts = message.parts.filter((part) => part.type === "file" && part.filename);
  const retry = message.parts.find((part) => part.type === "retry" || part.error);

  if (message.info.role === "user") {
    const userText = textParts.map(cleanText).join(" ");
    if (!/goal|continue|start|work|loop|run|grow/i.test(userText)) return null;
    return {
      tone: "blue",
      time: formatTime(message.info.time.created),
      title: "continued run",
      detail: ["read goal and advanced one step"],
      meta: tokenMeta(message),
    };
  }

  const title = textParts.map(titleFromText).find(Boolean) ?? (publicTools[0] ? summarizeTool(publicTools[0]) : "");
  if (!title) return null;
  if (/^(websearch|webfetch|read|write|edit)( ok)?$/i.test(title)) return null;

  const textDetails = textParts
    .flatMap(meaningfulLines)
    .filter((line) => line !== title)
    .slice(0, 2);

  const toolDetails = publicTools.slice(0, 2).map(summarizeTool);
  const fileDetails = fileParts
    .slice(0, 2)
    .map((part) => `saved ${part.filename}`)
    .filter(Boolean);

  const detail = [...toolDetails, ...fileDetails, ...textDetails].filter(
    (line, lineIndex, lines) => line && lines.indexOf(line) === lineIndex,
  );

  return {
    tone:
      retry || publicTools.some((part) => part.state?.status === "error")
        ? "red"
        : publicTools.some((part) => part.state?.status === "completed")
          ? "green"
          : "brown",
    time: formatTime(message.info.time.created),
    title,
    detail: detail.length > 0 ? detail : ["captured context"],
    meta: tokenMeta(message),
  };
}

function formatTokens(n: number): string {
  if (n === 0) return "0";
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  return `${(n / 1_000).toFixed(1)}k`;
}

function totalsFromMessages(messages: Message[], cumulative?: { tokens: number; cost: number } | null) {
  const tokens = cumulative?.tokens ?? messages.reduce((sum, message) => {
    const usage = message.info.tokens;
    return sum + (usage?.input ?? 0) + (usage?.output ?? 0);
  }, 0);
  const cost = cumulative?.cost ?? messages.reduce((sum, message) => sum + (message.info.cost ?? 0), 0);
  return {
    tokens: formatTokens(tokens),
    cost: cost > 0 ? money(cost) : "$0",
  };
}

function uniqueEvents(events: TraceEvent[]) {
  const seen = new Set<string>();
  return events.filter((event) => {
    const key = `${event.title}:${event.detail.join("|")}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function latestFileSection(markdown: string) {
  return (
    markdown
      .split(/\n(?=## )/)
      .map((section) => section.trim())
      .filter(Boolean)
      .at(-1) ?? ""
  );
}

function fallbackFromFiles(files: Record<string, string> | null | undefined): TraceEvent[] {
  if (!files) return fallbackEvents;
  const investors = files["INVESTORS.md"] ?? files["TARGETS.md"] ?? "";
  const latest = latestFileSection(investors);
  const candidate = latest.match(/^##\s+(.+)$/m)?.[1]?.trim();
  if (!candidate) return fallbackEvents;
  return [
    {
      tone: "green",
      time: "--:--:-- PM",
      title: `candidate identified: ${candidate}`,
      detail: ["waiting for live message stream"],
    },
  ];
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
    const interval = setInterval(load, 3000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);
  return data;
}

function TraceItem({ event }: { event: TraceEvent }) {
  const dotColor =
    event.tone === "green"
      ? "bg-[#1c9a65]"
      : event.tone === "red"
        ? "bg-[#ba2d2d]"
        : event.tone === "blue"
          ? "bg-[#0b55c9]"
          : "bg-[#9b7138]";

  return (
    <li className="relative flex gap-3 mb-7 last:mb-0">
      {/* Dot + connector line */}
      <div className="relative flex flex-col items-center pt-1.5 shrink-0">
        <span className={`w-2.5 h-2.5 rounded-full ${dotColor}`} />
        <div className="absolute top-4 left-1/2 -translate-x-1/2 w-px h-[calc(100%+28px)] bg-[rgba(25,31,42,0.13)]" />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        {/* Header row */}
        <div className="flex items-baseline gap-3 text-[11px] leading-relaxed flex-wrap">
          <time className="shrink-0 text-[rgba(25,31,42,0.5)] font-mono">{event.time}</time>
          <span className="shrink-0 font-semibold text-[rgba(25,31,42,0.7)]">orky</span>
          <strong className="font-bold text-[rgba(25,31,42,0.92)]">{event.title}</strong>
        </div>

        {/* Details */}
        {event.detail.length > 0 && (
          <div className="mt-1 space-y-1 text-[11px] leading-relaxed text-[rgba(25,31,42,0.58)]">
            {event.detail.slice(0, 3).map((line, index) => (
              <p key={index}>_ {line}</p>
            ))}
          </div>
        )}

        {/* Meta */}
        {event.meta && (
          <p className="mt-1 text-[10px] text-[rgba(25,31,42,0.5)]">{event.meta}</p>
        )}
      </div>
    </li>
  );
}

export default function AgentSidebar() {
  const data = useContextData();
  const messages = useMemo(() => data?.messages ?? [], [data?.messages]);

  const events = useMemo(() => {
    return uniqueEvents(
      messages
        .map(eventFromMessage)
        .filter((event): event is TraceEvent => event !== null),
    );
  }, [messages]);

  const visibleEvents = events.length > 0 ? events.slice(-7) : fallbackFromFiles(data?.files);
  const totals = totalsFromMessages(messages, data?.totals);

  return (
    <aside
      className="fixed z-[3] left-0 top-[68px] bottom-0 w-[min(38vw,540px)] flex flex-col overflow-hidden font-mono text-[11px] leading-relaxed pointer-events-none"
      style={{ background: "var(--orky-bg)", padding: "30px clamp(30px,3.2vw,58px) 0" }}
      aria-label="Public agent run"
    >
      <ol className="list-none m-0 p-0 flex-1 overflow-hidden">
        {visibleEvents.map((event, index) => (
          <TraceItem key={`${event.time}-${event.title}-${index}`} event={event} />
        ))}
      </ol>

      <div className="shrink-0 py-5 text-[13px] text-[rgba(25,31,42,0.86)]">
        <span className="text-[rgba(25,31,42,0.5)]">tokens</span>{" "}
        {totals.tokens}
        <span className="text-[rgba(25,31,42,0.5)] mx-1">/</span>
        <span className="text-[rgba(25,31,42,0.5)]">cost</span>{" "}
        {totals.cost}
        <span className="text-[rgba(25,31,42,0.5)] mx-1">/</span>
        <i className={`not-italic ${data?.active ? "text-[#1c9a65]" : "text-[rgba(25,31,42,0.5)]"}`}>
          {data?.active ? "live" : "napping"}
        </i>
      </div>
    </aside>
  );
}
