"use client";
import { useState, useEffect } from "react";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, Plus, ArrowRight } from "lucide-react";

import { Navbar } from "@/components/Navbar";
import { HeroSection } from "@/components/HeroSection";
import { HowItWorks } from "@/components/HowItWorks";
import { ClientSetup } from "@/components/ClientSetup";
import { Footer } from "@/components/Footer";

export default function Home() {
  const [copyStatus, setCopyStatus] = useState<Record<string, boolean>>({});
  const [user, setUser] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const [isMounted, setIsMounted] = useState(false);

  // Room state
  const [rooms, setRooms] = useState<any[]>([]);
  const [joinId, setJoinId] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setIsMounted(true);

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, [supabase.auth]);

  useEffect(() => {
    if (session?.access_token) fetchRooms();
  }, [session]);

  const fetchRooms = async () => {
    if (!session?.access_token) return;
    try {
      const res = await fetch("/api/rooms", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (data.rooms) setRooms(data.rooms);
    } catch (e) {
      console.error("Failed to fetch rooms:", e);
    }
  };

  const handleCreateRoom = async () => {
    if (!session?.access_token) return;
    setLoading(true);
    try {
      await fetch("/api/rooms", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "create" }),
      });
      await fetchRooms();
    } catch (e) {
      console.error("Failed to create room:", e);
    }
    setLoading(false);
  };

  const handleJoinRoom = async () => {
    if (!session?.access_token || !joinId.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "join", roomId: joinId.trim() }),
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
      } else {
        setJoinId("");
        await fetchRooms();
      }
    } catch (e) {
      console.error("Failed to join room:", e);
    }
    setLoading(false);
  };

  const handleSwitchRoom = async (roomId: string) => {
    if (!session?.access_token) return;
    setLoading(true);
    try {
      await fetch("/api/rooms", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "switch", roomId }),
      });
      await fetchRooms();
    } catch (e) {
      console.error("Failed to switch room:", e);
    }
    setLoading(false);
  };

  const handleCopy = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text);
    setCopyStatus((s) => ({ ...s, [key]: true }));
    setTimeout(() => setCopyStatus((s) => ({ ...s, [key]: false })), 1500);
  };

  const handleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setRooms([]);
  };

  const activeRoom = rooms.find((r) => r.isActive);

  const CopyBtn = ({ text, id }: { text: string; id: string }) => (
    <Button
      variant="ghost"
      size="icon"
      className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
      onClick={() => handleCopy(text, id)}
    >
      {copyStatus[id] ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </Button>
  );

  return (
    <main className="relative min-h-screen">
      {isMounted && <div className="bg-animation" suppressHydrationWarning />}

      <Navbar user={user} handleLogin={handleLogin} handleLogout={handleLogout} />

      <HeroSection />

      {/* ═══ SECTION 2: SETUP ═══ */}
      <section id="setup" className="relative z-10 py-24 md:py-32 border-t border-white/[0.06]">
        <div className="max-w-3xl mx-auto px-6 md:px-12">
          <ClientSetup handleCopy={handleCopy} copyStatus={copyStatus} />
        </div>
      </section>

      {/* ═══ SECTION 3: ROOMS DASHBOARD (signed-in only) ═══ */}
      {user && (
        <section id="rooms" className="relative z-10 py-24 md:py-32 border-t border-white/[0.06]">
          <div className="w-full max-w-xl mx-auto px-6 md:px-12">
            <div className="text-center mb-12">
              <h2 className="text-2xl font-semibold tracking-tight mb-2">Your Workspace</h2>
              <p className="text-sm text-muted-foreground">Create rooms, invite collaborators, and switch contexts.</p>
            </div>

            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xs font-medium tracking-widest uppercase text-muted-foreground">
                Rooms
              </h3>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCreateRoom}
                disabled={loading}
                className="gap-1.5 text-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                New Room
              </Button>
            </div>

            {/* Active Room */}
            {activeRoom && (
              <Card className="mb-4 border-white/[0.08] bg-black/50 overflow-hidden relative">
                <CardContent className="pt-6 relative z-10">
                  <Badge variant="outline" className="text-emerald-400 border-emerald-500/30 bg-emerald-500/10 mb-4 text-[10px] tracking-wider font-semibold">
                    ACTIVE
                  </Badge>
                  <div className="flex items-center gap-3 mt-1 mb-5">
                    <code className="text-sm bg-black/60 border border-white/[0.1] rounded-md px-3 py-2 flex-1 font-mono text-gray-200">
                      {activeRoom.id}
                    </code>
                    <Button variant="secondary" className="shadow-sm" onClick={() => handleCopy(activeRoom.id, "room")}>
                      {copyStatus["room"] ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                  <div className="flex items-center justify-between border-t border-white/[0.05] pt-5 mt-2">
                    <p className="text-xs text-muted-foreground leading-relaxed max-w-[60%]">
                      Share this ID with a friend. Once joined, both agents will read/write to the same file.
                    </p>
                    <Button asChild className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 shrink-0">
                      <a href="/dashboard">
                        Enter Workspace <ArrowRight className="w-4 h-4 ml-1.5" />
                      </a>
                    </Button>
                  </div>
                </CardContent>
                <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-emerald-500/5 to-transparent pointer-events-none" />
              </Card>
            )}

            {/* Join */}
            <div className="flex gap-2 mb-4">
              <Input
                placeholder="Paste a Room ID to join…"
                value={joinId}
                onChange={(e) => setJoinId(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleJoinRoom()}
                className="font-mono text-sm bg-black/40 border-white/[0.08] focus-visible:ring-primary/50"
              />
              <Button
                variant="secondary"
                size="default"
                onClick={handleJoinRoom}
                disabled={loading || !joinId.trim()}
                className="shrink-0 gap-1.5 font-medium"
              >
                Join Space
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Other rooms */}
            {rooms.filter((r) => !r.isActive).length > 0 && (
              <div className="space-y-2 mt-6">
                <h3 className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground/50 mb-3 px-1">
                  Inactive Rooms
                </h3>
                {rooms
                  .filter((r) => !r.isActive)
                  .map((room) => (
                    <div
                      key={room.id}
                      className="flex items-center justify-between px-4 py-3 rounded-lg border border-white/[0.05] bg-black/20 hover:bg-black/40 transition-colors"
                    >
                      <code className="text-xs text-muted-foreground font-mono">
                        {room.id.slice(0, 8)}…
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSwitchRoom(room.id)}
                        className="text-xs font-medium text-foreground hover:bg-white/[0.05]"
                      >
                        Switch To
                      </Button>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </section>
      )}

      <HowItWorks />



      <Footer />
    </main>
  );
}
