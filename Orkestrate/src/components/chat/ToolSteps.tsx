import { Search, Globe, ExternalLink, ChevronDown } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface ToolInvocation {
  toolCallId: string;
  toolName: string;
  args: any;
  state: 'call' | 'result';
  result?: any;
}

interface ToolStepsProps {
  invocations: ToolInvocation[];
}

function getToolInfo(toolName: string): { icon: ReactNode; label: string; color: string } {
  switch (toolName) {
    case 'search_context':
      return {
        icon: <Search className="size-3.5 opacity-40" />,
        label: 'Looked through your context',
        color: 'bg-blue-500/10 text-blue-500/60',
      };
    case 'fetch_url':
      return {
        icon: <ExternalLink className="size-3.5 opacity-40" />,
        label: 'Fetched a web page',
        color: 'bg-purple-500/10 text-purple-500/60',
      };
    case 'web_search':
      return {
        icon: <Globe className="size-3.5 opacity-40" />,
        label: 'Searched the web',
        color: 'bg-emerald-500/10 text-emerald-500/60',
      };
    default:
      return {
        icon: <Search className="size-3.5 opacity-40" />,
        label: `Ran ${toolName}`,
        color: 'bg-foreground/[0.04] text-foreground/35',
      };
  }
}

function getResultPreview(result: any, toolName: string): string | null {
  if (!result) return null;
  const text = typeof result === 'string' ? result : JSON.stringify(result);

  if (toolName === 'fetch_url') {
    const lines = text.split('\n').filter(l => l.trim());
    const preview = lines.slice(1, 4).join(' ').trim();
    if (preview.length > 200) return preview.slice(0, 200) + '...';
    return preview || null;
  }

  if (toolName === 'web_search') {
    try {
      const parsed = JSON.parse(text);
      const results = parsed.results;
      if (Array.isArray(results) && results.length > 0) {
        return `Found ${results.length} results`;
      }
    } catch {}
    const snippet = text.replace(/[{}"]/g, ' ').trim();
    if (snippet.length > 200) return snippet.slice(0, 200) + '...';
    return snippet.length > 0 ? snippet : null;
  }

  return text.length > 200 ? text.slice(0, 200) + '...' : text;
}

export function ToolSteps({ invocations }: ToolStepsProps) {
  const [isOpen, setIsOpen] = useState(true);

  if (invocations.length === 0) {
    return null;
  }

  return (
    <div className="mb-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 text-[13px] font-medium text-foreground/25 transition-colors hover:text-foreground/40"
      >
        <span>
          {invocations.length} {invocations.length === 1 ? 'Step' : 'Steps'}
        </span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        >
          <ChevronDown className="size-3 opacity-60" />
        </motion.div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="overflow-hidden"
          >
            <div className="mt-4 ml-1 space-y-6 border-l border-foreground/[0.04] pl-5 relative">
              {invocations.map((inv, idx) => {
                const info = getToolInfo(inv.toolName);
                const queries = inv.args?.queries;
                const url = inv.args?.url;
                const query = inv.args?.query;
                const resultPreview = inv.state === 'result' ? getResultPreview(inv.result, inv.toolName) : null;

                return (
                  <div key={inv.toolCallId || idx} className="relative group">
                    <div className="absolute -left-[22px] top-1.5 size-1 rounded-full bg-foreground/10 group-hover:bg-foreground/20 transition-colors" />

                    <div className="space-y-3">
                      <div className="flex items-center gap-2.5 text-[13px] font-medium text-foreground/35">
                        {info.icon}
                        <span>{info.label}</span>
                      </div>

                      {inv.toolName === 'search_context' && Array.isArray(queries) && queries.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {queries.map((q: string, i: number) => (
                            <motion.div
                              key={i}
                              initial={{ scale: 0.95, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              transition={{ delay: i * 0.03 }}
                              className="flex items-center gap-2 rounded-lg border border-foreground/[0.06] bg-foreground/[0.04] px-2.5 py-1.5 text-[12px] text-foreground/50 shadow-sm"
                            >
                              <Search className="size-3 opacity-20" />
                              {q}
                            </motion.div>
                          ))}
                        </div>
                      )}

                      {inv.toolName === 'fetch_url' && url && (
                        <motion.div
                          initial={{ scale: 0.95, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          className="flex items-center gap-2 rounded-lg border border-foreground/[0.06] bg-foreground/[0.04] px-2.5 py-1.5 text-[12px] text-foreground/50 shadow-sm truncate max-w-full"
                        >
                          <ExternalLink className="size-3 shrink-0 opacity-20" />
                          <span className="truncate">{url}</span>
                        </motion.div>
                      )}

                      {inv.toolName === 'web_search' && query && (
                        <motion.div
                          initial={{ scale: 0.95, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          className="flex items-center gap-2 rounded-lg border border-foreground/[0.06] bg-foreground/[0.04] px-2.5 py-1.5 text-[12px] text-foreground/50 shadow-sm"
                        >
                          <Globe className="size-3 shrink-0 opacity-20" />
                          <span>{query}</span>
                        </motion.div>
                      )}

                      {inv.state === 'call' && (
                        <div className="h-0.5 w-10 overflow-hidden rounded-full bg-foreground/[0.03]">
                          <motion.div
                            className="h-full bg-foreground/10"
                            animate={{ x: ["-100%", "100%"] }}
                            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                            style={{ width: "100%" }}
                          />
                        </div>
                      )}

                      {resultPreview && (
                        <motion.div
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="rounded-lg border border-foreground/[0.06] bg-foreground/[0.02] px-3 py-2 text-[12px] text-foreground/40 leading-relaxed"
                        >
                          {resultPreview}
                        </motion.div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
