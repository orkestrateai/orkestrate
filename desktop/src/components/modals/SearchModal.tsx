import { useState, useEffect } from 'react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { MessageSquare, Settings, Palette, Sun, Moon, Laptop, ArrowLeft } from 'lucide-react';
import { useTheme } from '@/lib/theme';

interface SearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenSettings: () => void;
}

export function SearchModal({ open, onOpenChange, onOpenSettings }: SearchModalProps) {
  const { theme, setTheme } = useTheme();
  const [view, setView] = useState<'main' | 'theme'>('main');

  // Reset view when modal closes
  useEffect(() => {
    if (!open) {
      setTimeout(() => setView('main'), 200);
    }
  }, [open]);

  // Ctrl+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onOpenChange]);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder={view === 'main' ? "Type a command or search..." : "Change theme"} />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {view === 'main' ? (
          <>
            <CommandGroup heading="Navigation">
              <CommandItem
                onSelect={() => {
                  onOpenChange(false);
                }}
              >
                <MessageSquare className="mr-2 size-4" />
                <span>Chats</span>
              </CommandItem>
              <CommandItem
                onSelect={() => {
                  onOpenChange(false);
                  onOpenSettings();
                }}
              >
                <Settings className="mr-2 size-4" />
                <span>Settings</span>
              </CommandItem>
            </CommandGroup>

            <CommandSeparator />

            <CommandGroup heading="Settings">
              <CommandItem
                onSelect={() => setView('theme')}
              >
                <Palette className="mr-2 size-4" />
                <span>
                  Change Theme{' '}
                  <span className="ml-1 text-xs text-muted-foreground capitalize">({theme})</span>
                </span>
              </CommandItem>
            </CommandGroup>
          </>
        ) : (
          <CommandGroup heading="Settings">
            <CommandItem onSelect={() => setView('main')}>
              <ArrowLeft className="mr-2 size-4" />
              <span>Back</span>
            </CommandItem>
            <CommandItem
              onSelect={() => {
                setTheme('dark');
                onOpenChange(false);
              }}
              className={theme === 'dark' ? 'bg-foreground/[0.05]' : ''}
            >
              <Moon className="mr-2 size-4" />
              <span>Dark</span>
            </CommandItem>
            <CommandItem
              onSelect={() => {
                setTheme('light');
                onOpenChange(false);
              }}
              className={theme === 'light' ? 'bg-foreground/[0.05]' : ''}
            >
              <Sun className="mr-2 size-4" />
              <span>Light</span>
            </CommandItem>
            <CommandItem
              onSelect={() => {
                setTheme('system');
                onOpenChange(false);
              }}
              className={theme === 'system' ? 'bg-foreground/[0.05]' : ''}
            >
              <Laptop className="mr-2 size-4" />
              <span>System</span>
            </CommandItem>
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
