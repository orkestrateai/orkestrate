import { Box, Text, type KeyEvent, type Renderable } from "@opentui/core";
import { join } from "node:path";
import { installPackFromDirectory } from "../../sdk/packs/store";

function clearChildren(node: Renderable) {
  for (const child of [...node.getChildren()]) {
    if (child.id) node.remove(child.id);
  }
}

const COLORS = {
  bg: "#111113",
  panel: "#18181b",
  text: "#f3f3f4",
  muted: "#9b9ba1",
  dim: "#6f6f76",
  accent: "#d97757",
};

export async function runWelcomeWizard(renderer: any): Promise<void> {
  return new Promise((resolve) => {
    const container = Box(
      {
        width: "100%",
        height: "100%",
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "column",
        backgroundColor: COLORS.bg,
      },
      Box(
        {
          flexDirection: "column",
          width: 72,
          paddingLeft: 4,
          paddingRight: 4,
          paddingTop: 2,
          paddingBottom: 2,
          backgroundColor: COLORS.panel,
        },
        Text({ content: "Orkestrate", fg: COLORS.text }),
        Text({ content: "Workbench for agent packs in this workspace.", fg: COLORS.muted }),
        Box({ height: 2 }),
        Text({ content: "No packs are installed yet.", fg: COLORS.muted }),
        Text({ content: "Install the coding pack to get started.", fg: COLORS.muted }),
        Box({ height: 2 }),
        Text({ content: "Press Enter to install coding", fg: COLORS.accent }),
        Text({ content: "Press Ctrl+C to exit", fg: COLORS.dim })
      )
    );

    renderer.root.add(container);

    const onKey = async (key: KeyEvent) => {
      if (key.name !== "return") return;

      renderer.keyInput.off("keypress", onKey);

      try {
        const moduleDir = import.meta.dir ?? process.cwd();
        const codingPack = join(moduleDir, "..", "..", "..", "packs", "coding");
        await installPackFromDirectory(codingPack, { target: "global" });
      } catch (error) {
        console.error("Failed to install coding pack", error);
      }

      clearChildren(renderer.root);
      resolve();
    };

    renderer.keyInput.on("keypress", onKey);
  });
}