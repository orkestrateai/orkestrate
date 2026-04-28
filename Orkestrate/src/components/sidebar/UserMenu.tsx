import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Settings, ArrowUpCircle, MessageCircle, HelpCircle, LogOut } from 'lucide-react';

interface UserMenuProps {
  onOpenSettings: () => void;
}

export function UserMenu({ onOpenSettings }: UserMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-foreground/[0.05]">
            {/* Avatar — 36px, matching Littlebird */}
            <div className="flex size-9 items-center justify-center rounded-full bg-foreground/[0.08] text-[14px] font-medium text-foreground/90">
              P
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[13px] font-medium text-foreground/90 leading-none">Prabhakaran K</span>
              <span className="text-[11px] text-foreground/45 leading-none">Basic</span>
            </div>
          </button>
        }
      />

      <DropdownMenuContent side="top" align="start" className="w-56">
        <DropdownMenuItem onClick={onOpenSettings}>
          <Settings className="mr-2 size-4" />
          Settings
        </DropdownMenuItem>
        <DropdownMenuItem disabled>
          <ArrowUpCircle className="mr-2 size-4" />
          Upgrade Plan
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem disabled>
          <MessageCircle className="mr-2 size-4" />
          Give Feedback
        </DropdownMenuItem>
        <DropdownMenuItem disabled>
          <HelpCircle className="mr-2 size-4" />
          Help Center
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem disabled>
          <LogOut className="mr-2 size-4" />
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
