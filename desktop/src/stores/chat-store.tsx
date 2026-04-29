import { createContext, useCallback, useContext, useEffect, useState, useRef, type ReactNode } from 'react';
import { nanoid } from 'nanoid';
import { invoke } from '@tauri-apps/api/core';

// ─── Types ──────────────────────────────────────────────────────────────────
export interface ChatSession {
  id: string;
  title: string;
  messages: any[];
  createdAt: number;
  updatedAt: number;
}

interface ChatStoreContextValue {
  sessions: ChatSession[];
  activeSessionId: string | null;
  createSession: (title?: string) => string;
  deleteSession: (id: string) => void;
  setActiveSession: (id: string | null) => void;
  updateSessionTitle: (id: string, title: string) => void;
  setSessionMessages: (id: string, messages: any[]) => void;
  touchSession: (id: string) => void;
}

const ChatStoreContext = createContext<ChatStoreContextValue | null>(null);

const STORAGE_KEY = 'orkestrate-chat-sessions';

function loadSessions(): ChatSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveSessions(sessions: ChatSession[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch { }
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function getMessageText(message: any): string {
  if (!message) return '';
  if (typeof message.content === 'string' && message.content.trim()) {
    return message.content;
  }
  if (Array.isArray(message.parts)) {
    return message.parts
      .filter((p: any) => p.type === 'text')
      .map((p: any) => p.text)
      .join('')
      .trim();
  }
  return '';
}

// ─── Provider ───────────────────────────────────────────────────────────────
export function ChatStoreProvider({ children }: { children: ReactNode }) {
  const [sessions, setSessions] = useState<ChatSession[]>(loadSessions);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const generatedTitles = useRef<Set<string>>(new Set());

  // Persist whenever sessions change
  useEffect(() => {
    saveSessions(sessions);
  }, [sessions]);

  const createSession = useCallback((title?: string) => {
    const id = nanoid(10);
    setActiveSessionId(id);
    return id;
  }, []);

  const deleteSession = useCallback((id: string) => {
    setSessions(prev => prev.filter(s => s.id !== id));
    setActiveSessionId(prev => (prev === id ? null : prev));
    generatedTitles.current.delete(id);
  }, []);

  const updateSessionTitle = useCallback((id: string, title: string) => {
    setSessions(prev =>
      prev.map(s => (s.id === id ? { ...s, title, updatedAt: Date.now() } : s))
    );
  }, []);

  const setSessionMessages = useCallback((id: string, messages: any[]) => {
    setSessions(prev => {
      const exists = prev.find(s => s.id === id);
      if (exists) {
        return prev.map(s => (s.id === id ? { ...s, messages, updatedAt: Date.now() } : s));
      } else {
        // First time this session gets messages
        const now = Date.now();
        const firstUserMsg = messages.find(m => m.role === 'user');
        const text = getMessageText(firstUserMsg) || 'New Chat';
        const initialTitle = text.length > 40 ? text.slice(0, 40) + '...' : text;

        console.log('[ChatStore] Creating session with initial title:', initialTitle);

        const newSession: ChatSession = {
          id,
          title: initialTitle,
          messages,
          createdAt: now,
          updatedAt: now,
        };
        return [newSession, ...prev];
      }
    });

    // Fire-and-forget title generation after first exchange (user + assistant)
    const userMsg = messages.find(m => m.role === 'user');
    const assistantMsg = messages.find(m => m.role === 'assistant');
    const userText = getMessageText(userMsg);
    const assistantText = getMessageText(assistantMsg);
    if (userText && assistantText && !generatedTitles.current.has(id)) {
      generatedTitles.current.add(id);
      console.log('[ChatStore] Triggering title generation with assistant context');
      invoke<string>('generate_chat_title', {
        userMessage: userText,
        assistantMessage: assistantText,
      })
        .then(newTitle => {
          console.log('[ChatStore] Title generated:', newTitle);
          if (newTitle) updateSessionTitle(id, newTitle);
        })
        .catch(err => {
          console.error('[ChatStore] Title generation failed:', err);
        });
    }
  }, [updateSessionTitle]);

  const touchSession = useCallback((id: string) => {
    setSessions(prev =>
      prev.map(s => (s.id === id ? { ...s, updatedAt: Date.now() } : s))
    );
  }, []);

  return (
    <ChatStoreContext.Provider
      value={{
        sessions,
        activeSessionId,
        createSession,
        deleteSession,
        setActiveSession: setActiveSessionId,
        updateSessionTitle,
        setSessionMessages,
        touchSession,
      }}
    >
      {children}
    </ChatStoreContext.Provider>
  );
}

export function useChatStore() {
  const ctx = useContext(ChatStoreContext);
  if (!ctx) throw new Error('useChatStore must be used within ChatStoreProvider');
  return ctx;
}
