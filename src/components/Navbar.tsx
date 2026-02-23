import { Button } from "@/components/ui/button";
import type { User } from "@supabase/supabase-js";
import Link from "next/link";

export function Navbar({
    user,
    handleLogin,
    handleLogout,
}: {
    user: User | null;
    handleLogin: () => void;
    handleLogout: () => void;
}) {
    return (
        <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-12 py-5 bg-background/60 backdrop-blur-xl border-b border-white/[0.06]">
            <div className="flex items-center gap-2.5">
                <svg width="24" height="24" viewBox="0 0 32 32" fill="none" className="shrink-0">
                    <path d="M8 13 C8 10.5, 10 9, 13 9 L17 9 C19.5 9, 21 10.5, 21 13 L21 16 C21 18.5, 19.5 19.5, 17 19.5 L14.5 19.5 L12 22 L12.5 19.5 L11 19.5 C9.5 19.5, 8 18.5, 8 16 Z" fill="#34d399" opacity="0.9" />
                    <path d="M12 14 C12 11.8, 13.8 10.5, 16 10.5 L20 10.5 C22.5 10.5, 24 11.8, 24 14 L24 17 C24 19, 22.5 20, 20 20 L19.5 20 L20 22.5 L17.5 20 L16 20 C13.8 20, 12 19, 12 17 Z" fill="currentColor" stroke="#34d399" strokeWidth="1.2" className="text-background" />
                    <circle cx="16.5" cy="15.5" r="1.2" fill="#34d399" />
                    <circle cx="19" cy="15.5" r="1.2" fill="#34d399" />
                    <circle cx="21.5" cy="15.5" r="1.2" fill="#34d399" />
                </svg>
                <span className="text-sm font-semibold tracking-widest uppercase">
                    Agen<span className="text-white">talk</span>
                </span>
            </div>
            <div className="flex items-center gap-3">
                {user ? (
                    <div className="flex items-center gap-3">
                        <Link href="/dashboard">
                            <Button variant="ghost" size="sm" className="hidden sm:inline-flex text-xs h-8">
                                Dashboard
                            </Button>
                        </Link>
                        {user.user_metadata?.avatar_url && (
                            <img
                                src={user.user_metadata.avatar_url}
                                alt="Avatar"
                                className="w-7 h-7 rounded-full ring-1 ring-white/10"
                            />
                        )}
                        <span className="text-sm text-muted-foreground hidden sm:inline">
                            {user.user_metadata?.full_name || user.email}
                        </span>
                        <Button variant="outline" size="sm" onClick={handleLogout} className="text-xs h-8">
                            Sign Out
                        </Button>
                    </div>
                ) : (
                    <Button variant="outline" size="sm" onClick={handleLogin} className="gap-2 text-xs h-8">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                        </svg>
                        Sign In
                    </Button>
                )}
            </div>
        </nav>
    );
}
