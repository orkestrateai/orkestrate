import { themeManager, type Theme } from './theme.svelte';
import { modelService } from './services/models.svelte';
import { Moon, Sun, LogOut, Cpu, AlertCircle, RotateCcw } from 'lucide-svelte';
import { getCurrentWindow } from '@tauri-apps/api/window';

export interface ActionResponse {
    type: 'action';
    content: string;
    icon: any;
}

class IntentEngine {
    /**
     * Attempts to handle an input string as a UI command.
     * Returns an ActionResponse if handled, null otherwise.
     * 
     * CRITICAL: Any input starting with ':' is treated as a command.
     * If the command is unrecognized, it returns an error response
     * and NEVER reaches the LLM.
     */
    handle(input: string): ActionResponse | null {
        const normalized = input.trim();

        // Block ALL colon-prefixed inputs from reaching the LLM
        if (normalized.startsWith(":")) {
            return this.handleCommand(normalized);
        }

        // No colon prefix → proceed to LLM
        return null;
    }

    private handleCommand(input: string): ActionResponse {
        // Remove the leading colon
        const withoutColon = input.slice(1).trim();
        
        // Use prefix matching to handle cases where the chip parser
        // swallows the space (e.g., :modelpickle -> :model pickle)
        const commands = [
            { names: ['quit', 'exit'], handler: () => this.executeQuit() },
            { names: ['model', 'models'], handler: (args: string) => this.executeModel(args) },
            { names: ['theme'], handler: (args: string) => this.executeTheme(args) },
            { names: ['reset', 'clear'], handler: () => this.executeReset() },
        ];
        
        for (const cmd of commands) {
            for (const name of cmd.names) {
                if (withoutColon.startsWith(name)) {
                    const args = withoutColon.slice(name.length).trim();
                    return cmd.handler(args);
                }
            }
        }
        
        // Extract the first word for the error message
        const firstWord = withoutColon.match(/^[a-zA-Z]+/)?.[0] || withoutColon.slice(0, 20);
        return {
            type: "action",
            content: `Unknown command: :${firstWord}`,
            icon: AlertCircle,
        };
    }

    private executeQuit(): ActionResponse {
        getCurrentWindow().close();
        return {
            type: "action",
            content: "Exiting Orkestrate...",
            icon: LogOut,
        };
    }

    private executeModel(args: string): ActionResponse {
        // If no args, open selector
        if (!args) {
            modelService.openSelector();
            return {
                type: "action",
                content: "Opening model selector...",
                icon: Cpu,
            };
        }

        // Try to match model by name or ID
        const query = args.toLowerCase();
        const matched = modelService.allModels.find(m => 
            m.id.toLowerCase() === query || 
            m.name.toLowerCase().includes(query)
        );

        if (matched) {
            modelService.selectModel(matched);
            return {
                type: "action",
                content: `Switched to ${matched.name}`,
                icon: Cpu,
            };
        }

        return {
            type: "action",
            content: `Model not found: ${args}`,
            icon: AlertCircle,
        };
    }

    private executeTheme(args: string): ActionResponse {
        const themeArg = args.toLowerCase();
        
        if (themeArg.includes("dark")) {
            themeManager.set("dark");
            return {
                type: "action",
                content: "Applied Dark Theme",
                icon: Moon,
            };
        } else if (themeArg.includes("light")) {
            themeManager.set("light");
            return {
                type: "action",
                content: "Applied Light Theme",
                icon: Sun,
            };
        }

        // Toggle if no specific theme mentioned
        const current = themeManager.current;
        const next: Theme = current === "dark" ? "light" : "dark";
        themeManager.set(next);
        return {
            type: "action",
            content: `Toggled to ${next} theme`,
            icon: next === "dark" ? Moon : Sun,
        };
    }

    private executeReset(): ActionResponse {
        return {
            type: "action",
            content: "Chat reset",
            icon: RotateCcw,
        };
    }

    /**
     * Checks if the input might be a command while typing.
     * Used for chip styling in ChatInput.
     */
    isCommandLikely(input: string): boolean {
        const normalized = input.toLowerCase().trim();
        return normalized.startsWith(":") || 
               ['dark', 'night', 'light', 'bright', 'model', 'theme', 'quit', 'exit', 'reset', 'clear'].some(k => 
                   normalized.includes(':' + k)
               );
    }
}

export const intentEngine = new IntentEngine();
