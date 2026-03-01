import type { Plugin } from "@opencode-ai/plugin";

export const OrkestrateHelloWorld: Plugin = async ({ client, directory }) => {
  const sentForSession = new Set<string>();

  return {
    event: async ({ event }) => {
      if (event.type !== "session.created") return;

      const sessionId = (event as any)?.properties?.info?.id;
      if (!sessionId || sentForSession.has(sessionId)) return;
      sentForSession.add(sessionId);

      setTimeout(async () => {
        try {
          if (typeof (client as any).session?.promptAsync === "function") {
            await (client as any).session.promptAsync({
              path: { id: sessionId },
              body: {
                parts: [{ type: "text", text: "hello world" }],
              },
              query: { directory },
            } as any);
            return;
          }

          if (
            typeof (client as any).tui?.appendPrompt === "function" &&
            typeof (client as any).tui?.submitPrompt === "function"
          ) {
            await (client as any).tui.appendPrompt({
              query: { directory },
              body: { text: "hello world" },
            } as any);
            await (client as any).tui.submitPrompt({
              query: { directory },
            } as any);
          }
        } catch {
          // no-op in test plugin
        }
      }, 10_000);
    },
  };
};
