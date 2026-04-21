export interface ModelInfo {
    id: string;
    name: string;
    provider: string;
    providerName: string;
    isFree: boolean;
    requiresApiKey: boolean;
}

const ALL_MODELS: ModelInfo[] = [
    {
        id: "nemotron-3-super-free",
        name: "Nemotron 3 Super Free",
        provider: "opencode-zen",
        providerName: "OpenCode Zen",
        isFree: true,
        requiresApiKey: false,
    },
    {
        id: "minimax-m2.5-free",
        name: "MiniMax M2.5 Free",
        provider: "opencode-zen",
        providerName: "OpenCode Zen",
        isFree: true,
        requiresApiKey: false,
    },
    {
        id: "big-pickle",
        name: "Big Pickle",
        provider: "opencode-zen",
        providerName: "OpenCode Zen",
        isFree: true,
        requiresApiKey: false,
    },
];

const STORAGE_KEY = "orkestrate:active-model";
const RECENT_KEY = "orkestrate:recent-models";
const MAX_RECENT = 3;

function loadActiveModel(): ModelInfo {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved) as ModelInfo;
            if (ALL_MODELS.find((m) => m.id === parsed.id)) return parsed;
        }
    } catch {
        // ignore
    }
    return ALL_MODELS[0];
}

function loadRecent(): string[] {
    try {
        const saved = localStorage.getItem(RECENT_KEY);
        if (saved) return JSON.parse(saved);
    } catch {
        // ignore
    }
    return [];
}

class ModelService {
    allModels = $state<ModelInfo[]>(ALL_MODELS);
    activeModel = $state<ModelInfo>(loadActiveModel());
    recentIds = $state<string[]>(loadRecent());
    isSelectorOpen = $state(false);

    get recentModels(): ModelInfo[] {
        return this.recentIds
            .map((id) => ALL_MODELS.find((m) => m.id === id))
            .filter(Boolean) as ModelInfo[];
    }

    get groupedModels(): Map<string, ModelInfo[]> {
        const map = new Map<string, ModelInfo[]>();
        for (const model of ALL_MODELS) {
            const list = map.get(model.providerName) || [];
            list.push(model);
            map.set(model.providerName, list);
        }
        return map;
    }

    selectModel(model: ModelInfo) {
        this.activeModel = model;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(model));

        // Update recents
        this.recentIds = [
            model.id,
            ...this.recentIds.filter((id) => id !== model.id),
        ].slice(0, MAX_RECENT);
        localStorage.setItem(RECENT_KEY, JSON.stringify(this.recentIds));
    }

    openSelector() {
        this.isSelectorOpen = true;
    }

    closeSelector() {
        this.isSelectorOpen = false;
    }
}

export const modelService = new ModelService();
