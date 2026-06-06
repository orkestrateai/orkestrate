import { createCliRenderer, Box, Text, CliRenderer } from "@opentui/core";
import type { KeyEvent, Renderable } from "@opentui/core";
import { runWelcomeWizard } from "./ui/welcome";
import { loadExtensions } from "../sdk/extensions/loader";
import type { Pack } from "../sdk/packs/schema";
import {
  installCatalogPack,
  listFullCatalog,
  listInstalledPacks,
  type CatalogEntry,
} from "../sdk/packs/catalog";
import { launchPack, stopRun } from "../sdk/launch/broker";
import { activeRunsForPack, listRuns, reconcileRuns } from "../sdk/runs/registry";
import type { RunRecord } from "../sdk/runs/types";
import { VERSION } from "../version";

type PackView = "installed" | "browse";
const ROOT_LAYOUT_ID = "root-layout";
const REFRESH_MS = 1500;

const COLORS = {
  bg: "#111113",
  panel: "#18181b",
  selected: "#252529",
  text: "#f3f3f4",
  muted: "#9b9ba1",
  dim: "#6f6f76",
  faint: "#4e4e55",
  accent: "#d97757",
  green: "#7fc18b",
  blue: "#6aa6f8",
};

function clearChildren(node: Renderable) {
  for (const child of [...node.getChildren()]) {
    if (child.id) node.remove(child.id);
  }
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return value.slice(0, max - 1) + "…";
}

const CSI_ARROW_UP = /\x1b\[[0-9;]*A$/;
const CSI_ARROW_DOWN = /\x1b\[[0-9;]*B$/;

function keyAction(key: KeyEvent): string | null {
  const n = key.name?.toLowerCase();
  const seq = key.sequence ?? "";

  if (
    n === "up" ||
    n === "k" ||
    seq === "\x1b[A" ||
    seq === "\x1bOA" ||
    CSI_ARROW_UP.test(seq)
  ) {
    return "up";
  }
  if (
    n === "down" ||
    n === "j" ||
    seq === "\x1b[B" ||
    seq === "\x1bOB" ||
    CSI_ARROW_DOWN.test(seq)
  ) {
    return "down";
  }
  if (n === "return" || n === "enter") return "return";
  if (n === "escape") return "escape";
  if (n === "q" && !key.ctrl) return "quit";
  if (key.ctrl && n === "c") return "quit";
  if (n === "b") return "browse";
  if (n === "i") return "installed";
  if (n === "l") return "launch";
  if (n === "s") return "stop";
  return n ?? null;
}

function packStatusLine(runs: RunRecord[], packId: string): string {
  const active = activeRunsForPack(runs, packId);
  if (active.length === 0) return "idle";
  if (active.length === 1) return `● running (${active[0]!.id})`;
  return `● running ×${active.length}`;
}

export async function runTui(): Promise<void> {
  await loadExtensions();

  let renderer: CliRenderer;
  const isWindows = process.platform === "win32";
  try {
    renderer = await createCliRenderer({
      exitOnCtrlC: false,
      backgroundColor: COLORS.bg,
      useKittyKeyboard: isWindows ? null : undefined,
    });
    renderer.start();
  } catch (error) {
    console.error("Failed to initialize TUI:", error);
    process.exit(1);
  }

  let installed = await listInstalledPacks();
  if (installed.length === 0) {
    await runWelcomeWizard(renderer);
    clearChildren(renderer.root);
    installed = await listInstalledPacks();
  }

  let catalog: CatalogEntry[] = await listFullCatalog();
  let runs: RunRecord[] = await listRuns();
  let packView: PackView = "installed";
  let selectedIndex = 0;
  let busy = false;
  let message = "";

  const packs = () => installed.map((l) => l.pack);

  async function refresh() {
    await reconcileRuns();
    runs = await listRuns();
    installed = await listInstalledPacks();
    catalog = await listFullCatalog();
  }

  function listCount(): number {
    if (packView === "browse") return catalog.length;
    return packs().length;
  }

  function selectedPack(): Pack | undefined {
    if (packView === "browse") return catalog[selectedIndex]?.pack;
    return packs()[selectedIndex];
  }

  function render() {
    renderer.currentFocusedRenderable?.blur();
    clearChildren(renderer.root);
    const count = listCount();
    selectedIndex = Math.min(selectedIndex, Math.max(0, count - 1));

    const rows: any[] = [];
    const title = packView === "browse" ? "Browse packs" : "Packs";

    if (packView === "installed") {
      for (let i = 0; i < packs().length; i++) {
        const p = packs()[i]!;
        const sel = i === selectedIndex;
        const status = packStatusLine(runs, p.id);
        const statusColor =
          status === "idle" ? COLORS.dim : status.startsWith("●") ? COLORS.green : COLORS.muted;
        rows.push(
          Box(
            {
              id: `row-${i}`,
              paddingLeft: 2,
              paddingTop: 1,
              backgroundColor: sel ? COLORS.selected : COLORS.panel,
              marginBottom: 1,
            },
            Text({ content: (sel ? "› " : "  ") + p.id, fg: sel ? COLORS.text : COLORS.muted }),
            Text({ content: truncate(p.description, 56), fg: COLORS.dim }),
            Text({ content: status, fg: statusColor })
          )
        );
      }
    } else {
      for (let i = 0; i < catalog.length; i++) {
        const e = catalog[i]!;
        const sel = i === selectedIndex;
        rows.push(
          Box(
            {
              id: `row-${i}`,
              paddingLeft: 2,
              paddingTop: 1,
              backgroundColor: sel ? COLORS.selected : COLORS.panel,
              marginBottom: 1,
            },
            Text({
              content:
                (sel ? "› " : "  ") +
                e.pack.id +
                (e.source === "registry" ? " [registry]" : "") +
                (e.installed ? " [installed]" : ""),
              fg: sel ? COLORS.text : COLORS.muted,
            }),
            Text({ content: truncate(e.pack.description, 70), fg: COLORS.dim })
          )
        );
      }
    }

    const footer =
      packView === "browse"
        ? "↑↓ move  Enter install  i installed  q quit"
        : "↑↓ move  Enter launch  l launch  s stop active  b browse  q quit";

    renderer.root.add(
      Box(
        {
          id: ROOT_LAYOUT_ID,
          focusable: true,
          live: true,
          flexDirection: "column",
          width: "100%",
          height: "100%",
          backgroundColor: COLORS.bg,
        },
        Box({ id: "header", paddingLeft: 2, paddingTop: 1 }, Text({ content: `Orkestrate v${VERSION}`, fg: COLORS.text })),
        Box({ id: "subtitle", paddingLeft: 2 }, Text({ content: title, fg: COLORS.muted })),
        Box({ id: "list", flexGrow: 1, flexDirection: "column", paddingTop: 1 }, ...rows),
        Box({ id: "footer", paddingLeft: 2, paddingBottom: 1 }, Text({ content: message || footer, fg: COLORS.faint }))
      )
    );

    const layout = renderer.root.getRenderable(ROOT_LAYOUT_ID);
    layout?.focus();
    renderer.requestRender();
  }

  async function stopActiveForPack(packId: string) {
    const active = activeRunsForPack(runs, packId);
    for (const run of active) {
      await stopRun(run.id);
    }
    return active.length;
  }

  async function handleKey(key: KeyEvent) {
    if (busy) return;
    const action = keyAction(key);
    if (!action) return;

    if (action === "quit") {
      renderer.keyInput.off("keypress", onKeyPress);
      renderer.destroy();
      process.exit(0);
    }

    if (action === "browse") {
      packView = "browse";
      selectedIndex = 0;
      render();
      return;
    }

    if (action === "installed") {
      packView = "installed";
      selectedIndex = 0;
      render();
      return;
    }

    if (action === "escape") {
      if (packView === "browse") {
        packView = "installed";
        selectedIndex = 0;
        render();
      }
      return;
    }

    if (action === "up") {
      selectedIndex = Math.max(0, selectedIndex - 1);
      render();
      return;
    }

    if (action === "down") {
      selectedIndex = Math.min(listCount() - 1, selectedIndex + 1);
      render();
      return;
    }

    if (action === "stop") {
      if (packView !== "installed") return;
      const pack = selectedPack();
      if (!pack) return;
      busy = true;
      try {
        const n = await stopActiveForPack(pack.id);
        message = n > 0 ? `Stopped ${n} session(s) for ${pack.id}` : `${pack.id} is idle`;
        await refresh();
      } catch (e) {
        message = e instanceof Error ? e.message : String(e);
      }
      busy = false;
      render();
      return;
    }

    if (action === "launch") {
      if (packView !== "installed") return;
      const pack = selectedPack();
      if (!pack) return;
      busy = true;
      try {
        await launchPack(pack.id);
        message = `Launched ${pack.id} in new terminal`;
        await refresh();
      } catch (e) {
        message = e instanceof Error ? e.message : String(e);
      }
      busy = false;
      render();
      return;
    }

    if (action === "return") {
      busy = true;
      try {
        if (packView === "browse") {
          const entry = catalog[selectedIndex];
          if (entry && !entry.installed) {
            await installCatalogPack(entry.slug);
            message = `Installed ${entry.pack.id}`;
            await refresh();
            packView = "installed";
          }
        } else {
          const pack = selectedPack();
          if (pack) {
            await launchPack(pack.id);
            message = `Launched ${pack.id} in new terminal`;
            await refresh();
          }
        }
      } catch (e) {
        message = e instanceof Error ? e.message : String(e);
      }
      busy = false;
      render();
    }
  }

  const onKeyPress = (key: KeyEvent) => {
    void handleKey(key);
  };
  renderer.keyInput.on("keypress", onKeyPress);

  await refresh();
  render();
  renderer.root.getRenderable(ROOT_LAYOUT_ID)?.focus();

  setInterval(() => {
    if (busy) return;
    void refresh().then(() => render());
  }, REFRESH_MS);

  await new Promise<void>(() => {});
}