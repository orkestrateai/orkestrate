import { invoke } from '@tauri-apps/api/core';

export interface Session {
    id: string;
    name: string;
    lastAccessed: string;
}

class SidebarStore {
    sessions = $state<Session[]>([]);
    currentSessionId = $state<string | null>(null);
    currentSessionName = $derived(
        this.sessions.find(s => s.id === this.currentSessionId)?.name || 'New Chat'
    );

    constructor() {
        this.loadSessions();
    }

    async loadSessions() {
        try {
            const sessions = await invoke<Session[]>('get_sessions');
            this.sessions = sessions;
        } catch (e) {
            console.error('Failed to load sessions:', e);
        }
    }

    async createSession(name: string) {
        try {
            const id = await invoke<string>('create_session', { name });
            await this.loadSessions();
            this.switchSession(id);
            return id;
        } catch (e) {
            console.error('Failed to create session:', e);
            throw e;
        }
    }

    async newChat() {
        // Don't create a session yet — just clear current state
        this.currentSessionId = null;
    }

    switchSession(id: string) {
        this.currentSessionId = id;
    }
}

export const sidebarStore = new SidebarStore();
