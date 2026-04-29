import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useChatStore } from '@/stores/chat-store';
import { useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';

const transport = new DefaultChatTransport({
  api: 'http://127.0.0.1:3001/api/chat',
});

export function useChatSession() {
  const {
    activeSessionId,
    sessions,
    createSession,
    setSessionMessages,
  } = useChatStore();

  const activeSession = sessions.find(s => s.id === activeSessionId);

  const chat = useChat({
    id: activeSessionId ?? undefined,
    initialMessages: activeSession?.messages || [],
    transport,
    onError: (error: any) => {
      console.error('[useChatSession] Chat error:', error);
      // Auto sign-out if token is invalid/expired
      const errMsg = typeof error === 'string' ? error : error?.message || '';
      if (errMsg.includes('401') || errMsg.includes('Unauthorized')) {
        invoke('sign_out').catch(() => {});
        window.location.reload();
      }
    },
  } as any);

  const { messages, sendMessage, status, setMessages } = chat;

  // Use a ref to track the session ID associated with the current messages state
  // to avoid saving messages from one session into another during a switch.
  const lastSyncedId = useRef<string | null>(null);

  // 1. Handle session switching: Load messages from store into useChat
  useEffect(() => {
    if (!activeSessionId || lastSyncedId.current === activeSessionId) return;

    const session = sessions.find(s => s.id === activeSessionId);
    if (session) {
      setMessages(session.messages || []);
    }
    lastSyncedId.current = activeSessionId;
  }, [activeSessionId, sessions, setMessages]);

  // Sync useChat messages to store as they update
  useEffect(() => {
    if (!activeSessionId || lastSyncedId.current !== activeSessionId) return;

    if (messages.length > 0) {
      setSessionMessages(activeSessionId, messages);
    }
  }, [messages, activeSessionId, setSessionMessages]);

  // Ref to queue a message that should be sent after session creation re-render
  const pendingMessage = useRef<string | null>(null);

  // Flush pending message after session is created and useChat re-initializes
  useEffect(() => {
    if (activeSessionId && pendingMessage.current) {
      const text = pendingMessage.current;
      pendingMessage.current = null;
      queueMicrotask(() => {
        sendMessage({ text });
      });
    }
  }, [activeSessionId, sendMessage]);

  const handleSendMessage = useCallback((text: string) => {
    if (!text.trim()) return;

    if (!activeSessionId) {
      pendingMessage.current = text.trim();
      createSession();
    } else {
      sendMessage({ text: text.trim() });
    }
  }, [activeSessionId, createSession, sendMessage]);

  return {
    messages,
    status,
    sendMessage: handleSendMessage,
    setMessages,
    activeSessionId,
  };
}
