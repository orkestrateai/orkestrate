import { browser } from '$app/environment';

export type Theme = 'light' | 'dark' | 'system';

class ThemeManager {
    #current = $state<Theme>('system');

    constructor() {
        if (browser) {
            const saved = localStorage.getItem('orkestrate-theme') as Theme;
            if (saved) {
                this.#current = saved;
            }
            this.apply();
            
            // Listen for system changes
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
                if (this.#current === 'system') {
                    this.apply();
                }
            });
        }
    }

    get current() {
        return this.#current;
    }

    set(theme: Theme) {
        this.#current = theme;
        if (browser) {
            localStorage.setItem('orkestrate-theme', theme);
            this.apply();
        }
    }

    apply() {
        if (!browser) return;

        const isDark = this.#current === 'dark' || 
            (this.#current === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

        document.documentElement.classList.toggle('dark', isDark);
    }
}

export const themeManager = new ThemeManager();
