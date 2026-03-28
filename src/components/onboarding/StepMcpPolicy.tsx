"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, ShieldCheck, Settings2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";
import { TOOL_CATEGORIES, type ToolCategory } from "@/lib/mcp-categories";
import type { McpSettings } from "@/db/schema";

type StepMcpPolicyProps = {
  mcpPolicyConfigured: boolean;
  onSaved: () => Promise<void> | void;
  onContinue: () => void;
};

const BALANCED_PRESET: McpSettings = {
  workspace: { enabled: true, disabledTools: [] },
  messaging: { enabled: true, disabledTools: [] },
  knowledge: { enabled: true, disabledTools: [] },
};

const GUARDED_PRESET: McpSettings = {
  workspace: { enabled: true, disabledTools: [] },
  messaging: { enabled: true, disabledTools: ["send_message", "read_messages"] },
  knowledge: { enabled: true, disabledTools: ["write_knowledge_base"] },
};

type Preset = "balanced" | "guarded" | "custom";

function cloneSettings(settings: McpSettings): McpSettings {
  return {
    workspace: {
      enabled: true,
      disabledTools: [],
    },
    messaging: {
      enabled: settings.messaging?.enabled ?? true,
      disabledTools: [...(settings.messaging?.disabledTools ?? [])],
    },
    knowledge: {
      enabled: settings.knowledge?.enabled ?? true,
      disabledTools: [...(settings.knowledge?.disabledTools ?? [])],
    },
  };
}

function resolvePreset(settings: McpSettings): Preset {
  const normalized = cloneSettings(settings);
  if (JSON.stringify(normalized) === JSON.stringify(BALANCED_PRESET)) {
    return "balanced";
  }
  if (JSON.stringify(normalized) === JSON.stringify(GUARDED_PRESET)) {
    return "guarded";
  }
  return "custom";
}

export function StepMcpPolicy({
  mcpPolicyConfigured,
  onSaved,
  onContinue,
}: StepMcpPolicyProps) {
  const [settings, setSettings] = useState<McpSettings>(cloneSettings(BALANCED_PRESET));
  const [activePreset, setActivePreset] = useState<Preset>("balanced");
  const [customMode, setCustomMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) {
          return;
        }

        const response = await fetch("/api/users/me/mcp-settings", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (!response.ok) {
          return;
        }

        const payload = await response.json();
        const loaded = payload?.result?.settings as McpSettings | undefined;
        if (!loaded) {
          return;
        }

        const normalized = cloneSettings(loaded);
        const resolved = resolvePreset(normalized);
        setSettings(normalized);
        setActivePreset(resolved);
        setCustomMode(resolved === "custom");
      } catch {
        setError("Failed to load settings.");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const categoryEntries = useMemo(
    () =>
      (Object.entries(TOOL_CATEGORIES) as unknown as Array<[ToolCategory, string[]]>).filter(
        ([category]) => category !== "workspace"
      ),
    []
  );

  const applyPreset = (preset: "balanced" | "guarded") => {
    setActivePreset(preset);
    setSettings(cloneSettings(preset === "balanced" ? BALANCED_PRESET : GUARDED_PRESET));
    setCustomMode(false);
  };

  const openCustomMode = () => {
    setActivePreset("custom");
    setCustomMode(true);
  };

  const toggleCategoryEnabled = (category: ToolCategory) => {
    setSettings((current) => {
      const existing = current[category] ?? { enabled: true, disabledTools: [] };
      return {
        ...current,
        [category]: {
          enabled: !existing.enabled,
          disabledTools: [...(existing.disabledTools ?? [])],
        },
      };
    });
    setActivePreset("custom");
  };

  const toggleTool = (category: ToolCategory, toolName: string) => {
    setSettings((current) => {
      const existing = current[category] ?? { enabled: true, disabledTools: [] };
      const disabledTools = new Set(existing.disabledTools ?? []);
      if (disabledTools.has(toolName)) {
        disabledTools.delete(toolName);
      } else {
        disabledTools.add(toolName);
      }

      return {
        ...current,
        [category]: {
          enabled: existing.enabled,
          disabledTools: Array.from(disabledTools),
        },
      };
    });
    setActivePreset("custom");
  };

  const saveAndContinue = async () => {
    setSaving(true);
    setError(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setError("Authentication required.");
        return;
      }

      const response = await fetch("/api/users/me/mcp-settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        setError(payload?.error?.message || "Failed to save policy.");
        return;
      }

      await onSaved();
      onContinue();
    } catch {
      setError("Failed to save policy.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
      </div>
    );
  }

  const canContinue = mcpPolicyConfigured || activePreset !== "custom" || customMode;

  return (
    <div className="space-y-6">
      <motion.div layout className="space-y-4">
        <AnimatePresence mode="wait" initial={false}>
          {!customMode ? (
            <motion.div
              key="preset-cards"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.18 }}
              className="space-y-3"
            >
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => applyPreset("balanced")}
                  className={`rounded-xl border px-4 py-4 text-left transition-colors ${
                    activePreset === "balanced"
                      ? "border-zinc-400 bg-zinc-900"
                      : "border-white/10 bg-white/[0.02] hover:bg-white/[0.05]"
                  }`}
                >
                  <div className="mb-2 inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-white/[0.03]">
                    <Settings2 className="h-4 w-4 text-zinc-300" />
                  </div>
                  <div className="text-sm font-semibold text-white">Access Policy</div>
                  <div className="mt-1 text-xs text-zinc-400">Standard settings. Agents can chat, update help docs, and notify you.</div>
                </button>

                <button
                  type="button"
                  onClick={() => applyPreset("guarded")}
                  className={`rounded-xl border px-4 py-4 text-left transition-colors ${
                    activePreset === "guarded"
                      ? "border-zinc-400 bg-zinc-900"
                      : "border-white/10 bg-white/[0.02] hover:bg-white/[0.05]"
                  }`}
                >
                  <div className="mb-2 inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-white/[0.03]">
                    <ShieldCheck className="h-4 w-4 text-zinc-300" />
                  </div>
                  <div className="text-sm font-semibold text-white">Restricted</div>
                  <div className="mt-1 text-xs text-zinc-400">Safe mode. Agents can read files but won't send messages.</div>
                </button>
              </div>

              <button
                type="button"
                onClick={openCustomMode}
                className="h-10 w-full rounded-xl border border-white/10 bg-white/[0.02] text-sm font-medium text-zinc-300 transition-colors hover:bg-white/[0.05]"
              >
                Customize permissions
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="custom-panel"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.18 }}
              className="space-y-3"
            >
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <div className="mb-3 text-[10px] uppercase font-black tracking-widest text-zinc-500">Fine-tune permissions</div>
                <div className="space-y-3">
                  {categoryEntries.map(([category, tools]) => {
                    const categorySettings = settings[category] ?? { enabled: true, disabledTools: [] };
                    const disabledTools = new Set(categorySettings.disabledTools ?? []);

                    return (
                      <div key={category} className="rounded-lg border border-white/5 bg-black/20 p-3">
                        <div className="mb-3 flex items-center justify-between">
                          <div className="text-[10px] uppercase font-black tracking-widest text-zinc-400">{category}</div>
                          <button
                            type="button"
                            onClick={() => toggleCategoryEnabled(category)}
                            className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wider transition-all ${
                              categorySettings.enabled
                                ? "border-zinc-500 bg-zinc-800 text-zinc-200"
                                : "border-zinc-700 bg-transparent text-zinc-600"
                            }`}
                          >
                            {categorySettings.enabled ? "Active" : "Disabled"}
                          </button>
                        </div>

                        <div className="grid gap-1.5">
                          {tools.map((toolName) => {
                            const enabled = !disabledTools.has(toolName);
                            return (
                              <button
                                key={toolName}
                                type="button"
                                onClick={() => toggleTool(category, toolName)}
                                disabled={!categorySettings.enabled}
                                className="flex items-center justify-between rounded-md px-2 py-1.5 text-left transition-colors hover:bg-white/[0.03] disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                <span className="text-[11px] font-semibold text-zinc-400 capitalize">
                                  {toolName.replace(/_/g, ' ')}
                                </span>
                                <div
                                  className={`inline-flex h-4 w-4 items-center justify-center rounded-sm border transition-all ${
                                    enabled
                                      ? "border-zinc-400 bg-white text-black"
                                      : "border-zinc-800 bg-transparent text-transparent"
                                  }`}
                                >
                                  {enabled && <Check className="h-3 w-3" strokeWidth={4} />}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 pt-2">
                <button
                  type="button"
                  onClick={() => applyPreset("balanced")}
                  className="h-10 rounded-xl border border-white/10 bg-white/[0.02] text-xs font-bold uppercase tracking-widest text-zinc-400 hover:bg-white/[0.05] hover:text-white transition-all"
                >
                  Standard
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset("guarded")}
                  className="h-10 rounded-xl border border-white/10 bg-white/[0.02] text-xs font-bold uppercase tracking-widest text-zinc-400 hover:bg-white/[0.05] hover:text-white transition-all"
                >
                  Strict
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs font-bold uppercase tracking-widest text-red-400">
          {error}
        </div>
      ) : null}

      <div className="pt-4">
        <button
          type="button"
          onClick={saveAndContinue}
          disabled={saving || !canContinue}
          className="inline-flex h-11 w-full items-center justify-center rounded-full bg-zinc-800 px-8 text-[15px] font-semibold text-zinc-300 transition-all hover:bg-zinc-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? (
            <div className="flex items-center gap-3">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Saving...</span>
            </div>
          ) : (
            "Save & Continue"
          )}
        </button>
      </div>
    </div>
  );
}
