"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Streamdown } from "streamdown";
import { cjk } from "@streamdown/cjk";
import { code } from "@streamdown/code";
import { math } from "@streamdown/math";
import { mermaid } from "@streamdown/mermaid";
import type { TranscriptEntry } from "./types";

type ToolState = {
  status?: string;
  input?: Record<string, unknown>;
  output?: string;
  title?: string;
  metadata?: Record<string, unknown>;
  raw?: string;
  time?: { start?: number; end?: number };
};

type PartNode = {
  id: string;
  type: string;
  messageID: string;
  sessionID?: string;
  text?: string;
  tool?: string;
  callID?: string;
  state?: ToolState;
  timeStart?: number;
  timeEnd?: number;
  sealed?: boolean;
  firstSeen: number;
  updatedOrder: number;
};

type MessageNode = {
  id: string;
  role: string;
  parentID?: string;
  modelID?: string;
  agent?: string;
  createdAtMs?: number;
  completedAtMs?: number;
  finish?: string;
  firstSeen: number;
  partOrder: string[];
  parts: Map<string, PartNode>;
};

type AssistantBlock = {
  kind: "assistant";
  id: string;
  parentID?: string;
  messages: MessageNode[];
};

type UserBlock = {
  kind: "user";
  id: string;
  text: string;
};

type RenderBlock = AssistantBlock | UserBlock;

const TOOL_STATUS_RANK: Record<string, number> = {
  pending: 1,
  running: 2,
  completed: 3,
  "output-available": 3,
  "output-error": 3,
};

const streamdownPlugins = { cjk, code, math, mermaid };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toMs(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function normalizeRole(role: unknown): string {
  return typeof role === "string" ? role.toLowerCase() : "";
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function safeTimeLabel(timestamp?: number) {
  if (!timestamp) return "";
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function formatDurationMs(startMs?: number, endMs?: number): string {
  if (!startMs || !endMs || endMs <= startMs) return "";
  const seconds = (endMs - startMs) / 1000;
  return `${seconds.toFixed(1)}s`;
}

function titleCase(word: string): string {
  if (!word) return word;
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function appendDelta(existing: string | undefined, delta: string) {
  const base = existing ?? "";
  if (!delta) return base;
  if (base.endsWith(delta)) return base;
  return `${base}${delta}`;
}

function mergeToolState(existing: ToolState | undefined, incoming: ToolState | undefined): ToolState | undefined {
  if (!existing && !incoming) return undefined;
  if (!existing) return incoming;
  if (!incoming) return existing;

  const existingStatus = existing.status ?? "";
  const incomingStatus = incoming.status ?? "";
  const existingRank = TOOL_STATUS_RANK[existingStatus] ?? 0;
  const incomingRank = TOOL_STATUS_RANK[incomingStatus] ?? 0;
  const status = incomingRank >= existingRank ? incomingStatus || existingStatus : existingStatus;

  const incomingInput = isRecord(incoming.input) ? incoming.input : undefined;
  const existingInput = isRecord(existing.input) ? existing.input : undefined;
  const input = incomingInput && Object.keys(incomingInput).length > 0
    ? { ...(existingInput ?? {}), ...incomingInput }
    : existingInput;

  const incomingOutput = nonEmptyString(incoming.output);
  const existingOutput = nonEmptyString(existing.output);
  const output = incomingOutput
    ? (
      existingOutput && existingOutput.length > incomingOutput.length && existingOutput.includes(incomingOutput)
        ? existingOutput
        : incomingOutput
    )
    : existingOutput;

  const title = nonEmptyString(incoming.title) || nonEmptyString(existing.title);

  const existingMetadata = isRecord(existing.metadata) ? existing.metadata : undefined;
  const incomingMetadata = isRecord(incoming.metadata) ? incoming.metadata : undefined;
  const metadata = incomingMetadata
    ? { ...(existingMetadata ?? {}), ...incomingMetadata }
    : existingMetadata;

  const existingRaw = nonEmptyString(existing.raw);
  const incomingRaw = nonEmptyString(incoming.raw);
  const raw = incomingRaw
    ? (
      existingRaw && existingRaw.length > incomingRaw.length && existingRaw.includes(incomingRaw)
        ? existingRaw
        : incomingRaw
    )
    : existingRaw;

  const time = {
    start:
      typeof existing.time?.start === "number" && typeof incoming.time?.start === "number"
        ? Math.min(existing.time.start, incoming.time.start)
        : existing.time?.start ?? incoming.time?.start,
    end:
      typeof existing.time?.end === "number" && typeof incoming.time?.end === "number"
        ? Math.max(existing.time.end, incoming.time.end)
        : existing.time?.end ?? incoming.time?.end,
  };

  return { status, input, output, title, metadata, raw, time };
}

function mergePart(existing: PartNode | undefined, incoming: PartNode): PartNode {
  if (!existing) return incoming;

  const existingText = existing.text;
  const incomingText = incoming.text;
  const existingSealed = Boolean(existing.sealed);
  const incomingSealed = Boolean(incoming.sealed);

  let text = existingText;
  if (typeof incomingText === "string") {
    if (!existingText) {
      text = incomingText;
    } else if (!incomingText) {
      text = existingText;
    } else if (incomingText === existingText) {
      text = existingText;
    } else if (incomingText.includes(existingText)) {
      text = incomingText;
    } else if (existingText.includes(incomingText)) {
      text = existingText;
    } else if (existingSealed && !incomingSealed) {
      text = existingText;
    } else if (!existingSealed && incomingSealed) {
      text = incomingText;
    } else {
      text = incomingText.length >= existingText.length ? incomingText : existingText;
    }
  }

  return {
    ...existing,
    ...incoming,
    text,
    tool: incoming.tool ?? existing.tool,
    callID: incoming.callID ?? existing.callID,
    state: mergeToolState(existing.state, incoming.state),
    timeStart: incoming.timeStart ?? existing.timeStart,
    timeEnd: incoming.timeEnd ?? existing.timeEnd,
    sealed: existing.sealed || incoming.sealed,
    firstSeen: existing.firstSeen,
    updatedOrder: Math.max(existing.updatedOrder, incoming.updatedOrder),
  };
}

function extractTextParts(message: MessageNode) {
  return message.partOrder
    .map((partID) => message.parts.get(partID))
    .filter((part): part is PartNode => Boolean(part))
    .filter((part) => part.type === "text" && typeof part.text === "string" && part.text.trim().length > 0)
    .map((part) => part.text!.trim())
    .join("\n\n");
}

function buildRenderBlocks(logs: TranscriptEntry[]): RenderBlock[] {
  let seq = 0;
  const messages = new Map<string, MessageNode>();
  const callToPart = new Map<string, { messageID: string; partID: string }>();
  const pendingToolStart = new Map<string, Record<string, unknown>>();
  const pendingToolEnd = new Map<string, Record<string, unknown>>();

  const nextSeq = () => {
    seq += 1;
    return seq;
  };

  const ensureMessage = (id: string) => {
    let message = messages.get(id);
    if (!message) {
      message = {
        id,
        role: "",
        firstSeen: nextSeq(),
        partOrder: [],
        parts: new Map<string, PartNode>(),
      };
      messages.set(id, message);
    }
    return message;
  };

  const applyToolStart = (callID: string, payload: Record<string, unknown>) => {
    const ref = callToPart.get(callID);
    if (!ref) {
      pendingToolStart.set(callID, payload);
      return;
    }
    const message = messages.get(ref.messageID);
    if (!message) return;
    const part = message.parts.get(ref.partID);
    if (!part) return;

    const output = isRecord(payload.output) ? payload.output : {};
    const args = isRecord(output.args) ? output.args : {};
    const description = nonEmptyString(args.description);
    part.state = mergeToolState(part.state, {
      status: "running",
      input: args,
      title: description,
      metadata: description ? { description } : undefined,
    });
  };

  const applyToolEnd = (callID: string, payload: Record<string, unknown>) => {
    const ref = callToPart.get(callID);
    if (!ref) {
      pendingToolEnd.set(callID, payload);
      return;
    }
    const message = messages.get(ref.messageID);
    if (!message) return;
    const part = message.parts.get(ref.partID);
    if (!part) return;

    const input = isRecord(payload.input) ? payload.input : {};
    const output = isRecord(payload.output) ? payload.output : {};
    const args = isRecord(input.args) ? input.args : undefined;
    const title = nonEmptyString(output.title) || nonEmptyString(args?.description);
    const outputText =
      nonEmptyString(output.output) ||
      nonEmptyString(isRecord(output.metadata) ? output.metadata.output : undefined) ||
      undefined;
    const metadata = isRecord(output.metadata) ? output.metadata : undefined;

    part.state = mergeToolState(part.state, {
      status: "completed",
      input: args,
      title,
      output: outputText,
      metadata,
    });
  };

  const upsertPart = (partRaw: unknown, entryTsMs?: number) => {
    if (!isRecord(partRaw)) return;
    const partID = nonEmptyString(partRaw.id);
    const messageID = nonEmptyString(partRaw.messageID);
    if (!partID || !messageID) return;

    const message = ensureMessage(messageID);
    if (!message.partOrder.includes(partID)) message.partOrder.push(partID);

    const partSeq = nextSeq();
    const partState = isRecord(partRaw.state) ? (partRaw.state as ToolState) : undefined;
    const partTime = isRecord(partRaw.time) ? partRaw.time : undefined;
    const partTimeEnd = toMs(partTime?.end);
    const incoming: PartNode = {
      id: partID,
      type: nonEmptyString(partRaw.type) || "unknown",
      messageID,
      sessionID: nonEmptyString(partRaw.sessionID),
      text: typeof partRaw.text === "string" ? partRaw.text : undefined,
      tool: nonEmptyString(partRaw.tool),
      callID: nonEmptyString(partRaw.callID),
      state: partState,
      timeStart: toMs(partTime?.start),
      timeEnd: partTimeEnd,
      sealed: Boolean(partTimeEnd),
      firstSeen: partSeq,
      updatedOrder: partSeq,
    };

    const existing = message.parts.get(partID);
    const merged = mergePart(existing, incoming);
    message.parts.set(partID, merged);

    if (merged.callID) {
      callToPart.set(merged.callID, { messageID, partID });

      const startPayload = pendingToolStart.get(merged.callID);
      if (startPayload) {
        applyToolStart(merged.callID, startPayload);
        pendingToolStart.delete(merged.callID);
      }
      const endPayload = pendingToolEnd.get(merged.callID);
      if (endPayload) {
        applyToolEnd(merged.callID, endPayload);
        pendingToolEnd.delete(merged.callID);
      }
    }

    if (!message.createdAtMs && entryTsMs) message.createdAtMs = entryTsMs;
  };

  const upsertMessageFromInfo = (infoRaw: unknown, entryTsMs?: number) => {
    if (!isRecord(infoRaw)) return;
    const id = nonEmptyString(infoRaw.id);
    if (!id) return;

    const message = ensureMessage(id);
    message.role = normalizeRole(infoRaw.role) || message.role;
    message.parentID = nonEmptyString(infoRaw.parentID) || message.parentID;
    message.modelID = nonEmptyString(infoRaw.modelID)
      || nonEmptyString(isRecord(infoRaw.model) ? infoRaw.model.modelID : undefined)
      || message.modelID;
    message.agent = nonEmptyString(infoRaw.agent) || message.agent;
    message.finish = nonEmptyString(infoRaw.finish) || message.finish;

    const time = isRecord(infoRaw.time) ? infoRaw.time : undefined;
    const createdAt = toMs(time?.created) ?? entryTsMs;
    const completedAt = toMs(time?.completed);
    if (createdAt) message.createdAtMs = message.createdAtMs ? Math.min(message.createdAtMs, createdAt) : createdAt;
    if (completedAt) {
      message.completedAtMs = completedAt;
      for (const part of message.parts.values()) {
        if (part.type === "text" || part.type === "reasoning") {
          part.sealed = true;
        }
      }
    }
  };

  for (const entry of logs) {
    const entryTsMs = toMs(entry.timestamp);

    if (entry.type === "user_message" && isRecord(entry.payload)) {
      const out = isRecord(entry.payload.output) ? entry.payload.output : {};
      const message = isRecord(out.message) ? out.message : {};
      upsertMessageFromInfo(message, entryTsMs);

      const parts = Array.isArray(out.parts) ? out.parts : [];
      for (const part of parts) upsertPart(part, entryTsMs);
      continue;
    }

    if (entry.type === "tool_start" && isRecord(entry.payload)) {
      const input = isRecord(entry.payload.input) ? entry.payload.input : {};
      const callID = nonEmptyString(input.callID);
      if (callID) applyToolStart(callID, entry.payload);
      continue;
    }

    if (entry.type === "tool_end" && isRecord(entry.payload)) {
      const input = isRecord(entry.payload.input) ? entry.payload.input : {};
      const callID = nonEmptyString(input.callID);
      if (callID) applyToolEnd(callID, entry.payload);
      continue;
    }

    if (entry.type !== "event" || !isRecord(entry.payload)) continue;
    const e = isRecord(entry.payload.e) ? entry.payload.e : undefined;
    if (!e) continue;
    const eventType = nonEmptyString(e.type);
    if (!eventType) continue;
    const props = isRecord(e.properties) ? e.properties : {};

    if (eventType === "message.updated") {
      upsertMessageFromInfo(props.info, entryTsMs);
      continue;
    }

    if (eventType === "message.part.updated") {
      upsertPart(props.part, entryTsMs);
      continue;
    }

    if (eventType === "message.part.delta") {
      const partID = nonEmptyString(props.partID);
      const messageID = nonEmptyString(props.messageID);
      const delta = typeof props.delta === "string" ? props.delta : "";
      const field = nonEmptyString(props.field);
      if (!partID || !messageID || field !== "text") continue;
      if (!delta) continue;

      const message = ensureMessage(messageID);
      if (!message.partOrder.includes(partID)) message.partOrder.push(partID);

      const existing = message.parts.get(partID);
      if (existing?.sealed) continue;
      const basePart: PartNode = existing ?? {
        id: partID,
        type: "text",
        messageID,
        firstSeen: nextSeq(),
        updatedOrder: nextSeq(),
      };

      const nextText = appendDelta(basePart.text, delta);
      message.parts.set(partID, {
        ...basePart,
        text: nextText,
        updatedOrder: nextSeq(),
      });
    }
  }

  const sortedMessages = [...messages.values()].sort((a, b) => {
    const aKey = a.createdAtMs ?? Number.MAX_SAFE_INTEGER;
    const bKey = b.createdAtMs ?? Number.MAX_SAFE_INTEGER;
    if (aKey !== bKey) return aKey - bKey;
    return a.firstSeen - b.firstSeen;
  });

  const blocks: RenderBlock[] = [];
  for (const message of sortedMessages) {
    if (message.role === "user") {
      const text = extractTextParts(message);
      if (text) blocks.push({ kind: "user", id: message.id, text });
      continue;
    }

    if (message.role !== "assistant") continue;

    const last = blocks[blocks.length - 1];
    if (
      last &&
      last.kind === "assistant" &&
      last.parentID &&
      message.parentID &&
      last.parentID === message.parentID
    ) {
      last.messages.push(message);
    } else {
      blocks.push({
        kind: "assistant",
        id: message.id,
        parentID: message.parentID,
        messages: [message],
      });
    }
  }

  return blocks;
}

function ReasoningBlock({ text }: { text: string }) {
  return (
    <div className="my-3 border-l border-[#2D2D2D] pl-4 text-[16px] leading-[1.6] text-[#AFAFAF]">
      <span className="text-[#D2A940] italic">Thinking:</span>{" "}
      <span className="align-top">
        <Streamdown plugins={streamdownPlugins}>{text}</Streamdown>
      </span>
    </div>
  );
}

function TextBlock({ text }: { text: string }) {
  return (
    <div className="my-3 text-[17px] leading-[1.55] text-[#E9E9E9]">
      <Streamdown plugins={streamdownPlugins}>{text}</Streamdown>
    </div>
  );
}

function ToolCard({ part }: { part: PartNode }) {
  const [expanded, setExpanded] = useState(false);

  const state = part.state ?? {};
  const input = isRecord(state.input) ? state.input : {};
  const command = nonEmptyString(input.command) || "";
  const description =
    nonEmptyString(state.title) ||
    nonEmptyString(input.description) ||
    nonEmptyString(state.metadata?.description) ||
    nonEmptyString(part.tool) ||
    "Tool call";
  const output =
    nonEmptyString(state.output) ||
    nonEmptyString(isRecord(state.metadata) ? state.metadata.output : undefined) ||
    nonEmptyString(state.raw) ||
    "";

  const outputLines = output.split("\n");
  const hasOverflow = outputLines.length > 12;
  const shownOutput = expanded || !hasOverflow
    ? output
    : `${outputLines.slice(0, 10).join("\n")}\n...`;

  return (
    <div className="my-3 rounded-none bg-[#1A1A1A] border border-[#2A2A2A] px-5 py-4 text-[15px] font-mono text-[#DCDCDC]">
      <div className="mb-2 text-[#878787]"># {description}</div>
      {command && <div className="mb-4 text-[#F2F2F2]">$ {command}</div>}
      {shownOutput && (
        <pre className="whitespace-pre-wrap break-words text-[#E2E2E2] leading-[1.45] text-[15px]">
          {shownOutput}
        </pre>
      )}
      {hasOverflow && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="mt-3 text-[#8A8A8A] hover:text-[#CACACA] transition-colors"
        >
          {expanded ? "Click to collapse" : "Click to expand"}
        </button>
      )}
    </div>
  );
}

function UserPrompt({ text }: { text: string }) {
  return (
    <div className="my-3 border-l-2 border-[#3BA2FF] bg-[#181818] px-5 py-3 text-[17px] leading-[1.45] text-[#F1F1F1]">
      <Streamdown plugins={streamdownPlugins}>{text}</Streamdown>
    </div>
  );
}

function AssistantBlockView({ block }: { block: AssistantBlock }) {
  const messages = [...block.messages].sort((a, b) => {
    const aKey = a.createdAtMs ?? Number.MAX_SAFE_INTEGER;
    const bKey = b.createdAtMs ?? Number.MAX_SAFE_INTEGER;
    if (aKey !== bKey) return aKey - bKey;
    return a.firstSeen - b.firstSeen;
  });

  const parts: PartNode[] = [];
  for (const message of messages) {
    const orderedParts = message.partOrder
      .map((partID) => message.parts.get(partID))
      .filter((part): part is PartNode => Boolean(part))
      .sort((a, b) => a.firstSeen - b.firstSeen);
    parts.push(...orderedParts);
  }

  const visibleParts = parts.filter((part) => {
    if (part.type === "step-start" || part.type === "step-finish") return false;
    if (part.type === "text" || part.type === "reasoning") {
      return typeof part.text === "string" && part.text.trim().length > 0;
    }
    if (part.type === "tool") return true;
    return false;
  });

  const firstMessage = messages[0];
  const lastMessage = messages[messages.length - 1];
  const agent = titleCase((lastMessage.agent || firstMessage.agent || "assistant").toLowerCase());
  const model = lastMessage.modelID || firstMessage.modelID || "unknown-model";
  const duration = formatDurationMs(firstMessage.createdAtMs, lastMessage.completedAtMs ?? lastMessage.createdAtMs);

  if (visibleParts.length === 0) return null;

  return (
    <div className="my-3">
      {visibleParts.map((part) => {
        if (part.type === "reasoning") return <ReasoningBlock key={part.id} text={part.text || ""} />;
        if (part.type === "tool") return <ToolCard key={part.id} part={part} />;
        return <TextBlock key={part.id} text={part.text || ""} />;
      })}

      <div className="mt-4 text-[13px] font-mono text-[#8E8E8E] flex items-center gap-2">
        <span className="text-[#56A8FF]">o</span>
        <span className="text-[#8DC3FF]">{agent}</span>
        <span>-</span>
        <span>{model}</span>
        {duration && (
          <>
            <span>-</span>
            <span>{duration}</span>
          </>
        )}
      </div>
    </div>
  );
}

export function OpenCodeRenderer({ logs }: { logs: TranscriptEntry[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const blocks = useMemo(() => buildRenderBlocks(logs), [logs]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [blocks]);

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto px-8 py-6 no-scrollbar">
      <div className="max-w-5xl mx-auto w-full pb-12">
        {blocks.length === 0 ? (
          <div className="text-center text-[13px] text-[#6C6C6C] py-12">Waiting for events...</div>
        ) : (
          blocks.map((block) => (block.kind === "user"
            ? <UserPrompt key={block.id} text={block.text} />
            : <AssistantBlockView key={block.id} block={block} />))
        )}
      </div>
      {logs.length > 0 && (
        <div className="mt-3 text-[11px] font-mono text-[#595959]">
          Last event at {safeTimeLabel(toMs(logs[logs.length - 1]?.timestamp))}
        </div>
      )}
    </div>
  );
}
