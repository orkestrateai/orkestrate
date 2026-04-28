import { useState } from 'react';
import { X } from 'lucide-react';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

const TABS = ['General', 'System', 'Appearance', 'Chat', 'Subscription', 'Support'] as const;
type Tab = (typeof TABS)[number];

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>('Appearance');
  const { theme, setTheme } = useTheme();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="flex h-[80vh] w-[760px] max-w-[90vw] overflow-hidden rounded-2xl border border-white/[0.06] bg-[oklch(0.13_0_0)] shadow-2xl">
        {/* Left nav */}
        <nav className="flex w-[200px] flex-shrink-0 flex-col gap-0.5 border-r border-white/[0.06] p-4">
          <h2 className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-white/40">
            Settings
          </h2>
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'rounded-lg px-3 py-2 text-left text-sm transition-colors',
                activeTab === tab
                  ? 'bg-white/[0.08] text-white font-medium'
                  : 'text-white/60 hover:bg-white/[0.04] hover:text-white/80'
              )}
            >
              {tab}
            </button>
          ))}
        </nav>

        {/* Content */}
        <div className="flex flex-1 flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4">
            <h3 className="text-lg font-semibold text-white">{activeTab}</h3>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-white/50 transition-colors hover:bg-white/[0.06] hover:text-white/90"
            >
              <X className="size-5" />
            </button>
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === 'Appearance' && (
              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-medium text-white/90">Theme</h4>
                  <p className="mt-1 text-sm text-white/50">
                    Choose how Orkestrate looks to you.
                  </p>
                </div>
                <div className="flex gap-3">
                  {(['light', 'dark', 'system'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setTheme(t)}
                      className={cn(
                        'flex flex-col items-center gap-2 rounded-xl border p-4 transition-all',
                        theme === t
                          ? 'border-white/30 bg-white/[0.08] text-white'
                          : 'border-white/[0.06] text-white/50 hover:border-white/[0.12] hover:text-white/70'
                      )}
                    >
                      {/* Theme preview swatch */}
                      <div
                        className={cn(
                          'size-16 rounded-lg border',
                          t === 'light'
                            ? 'border-neutral-300 bg-white'
                            : t === 'dark'
                              ? 'border-neutral-700 bg-neutral-900'
                              : 'bg-gradient-to-br from-white to-neutral-900 border-neutral-500'
                        )}
                      />
                      <span className="text-sm font-medium capitalize">{t}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'General' && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-white/90">Name</label>
                  <input
                    readOnly
                    value="Prabhakaran K"
                    className="mt-2 w-full rounded-lg border border-white/[0.06] bg-white/[0.04] px-3 py-2 text-sm text-white/90"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/90">Email</label>
                  <input
                    readOnly
                    value="prabhakaran@orkestrate.ai"
                    className="mt-2 w-full rounded-lg border border-white/[0.06] bg-white/[0.04] px-3 py-2 text-sm text-white/90"
                  />
                </div>
              </div>
            )}

            {!['Appearance', 'General'].includes(activeTab) && (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-white/30">Coming soon</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
