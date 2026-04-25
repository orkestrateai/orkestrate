export const viewStore = $state({
	currentView: "chat" as "chat" | "memory"
});

export function showChat() {
	viewStore.currentView = "chat";
}

export function showMemory() {
	viewStore.currentView = "memory";
}
