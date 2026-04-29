import { UserMenu } from './UserMenu';

interface SidebarFooterProps {
  onOpenSettings: () => void;
  onSignOut: () => void;
}

export function SidebarFooter({ onOpenSettings, onSignOut }: SidebarFooterProps) {
  return (
    <div className="mt-auto flex flex-col gap-2 px-3 pb-3">
      {/* Context enabled — bordered pill, green dot RIGHT, matching Littlebird exactly */}
      <div className="flex items-center justify-between rounded-xl border border-foreground/[0.08] px-4 py-2">
        <span className="text-[13px] text-foreground/55">Context enabled</span>
        <span className="size-2 rounded-full bg-emerald-500" />
      </div>

      {/* User profile */}
      <UserMenu onOpenSettings={onOpenSettings} onSignOut={onSignOut} />
    </div>
  );
}
