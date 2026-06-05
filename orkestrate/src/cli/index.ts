import { loadExtensions } from "../sdk/extensions/loader";
import { runTui } from "./tui";
import { listInstalledPacks } from "../sdk/packs/catalog";
import { getAdapter } from "../sdk/registry";
import { VERSION } from "../version";

await loadExtensions();

const command = Bun.argv[2];

if (!command) {
  await runTui();
} else if (command === "doctor") {
  const installed = await listInstalledPacks();
  console.log(`Orkestrate Doctor v${VERSION}`);
  console.log(`Packs: ${installed.length}`);
  for (const { pack } of installed) {
    const adapter = getAdapter(pack.harness);
    const status = adapter ? await adapter.detect() : { installed: false, error: "no driver" };
    console.log(`  ${pack.id}: ${pack.harness} (${status.installed ? "ok" : status.error ?? "missing"})`);
  }
} else if (command === "pack") {
  const sub = Bun.argv[3];
  if (sub === "list") {
    const { runPackList } = await import("./cmd/pack");
    await runPackList();
  } else if (sub === "install") {
    const slug = Bun.argv[4];
    if (!slug) {
      console.error("Usage: orkestrate pack install <slug> [--global]");
      process.exit(1);
    }
    const { runPackInstall } = await import("./cmd/pack");
    await runPackInstall(slug, Bun.argv.includes("--global"));
  } else if (sub === "validate") {
    const id = Bun.argv[4];
    if (!id) {
      console.error("Usage: orkestrate pack validate <pack-id>");
      process.exit(1);
    }
    const { runPackValidate } = await import("./cmd/pack");
    await runPackValidate(id);
  } else if (sub === "create") {
    const id = Bun.argv[4];
    if (!id) {
      console.error("Usage: orkestrate pack create <pack-id> [--from coding] [--description \"...\"] [--global]");
      process.exit(1);
    }
    const fromIdx = Bun.argv.indexOf("--from");
    const descIdx = Bun.argv.indexOf("--description");
    const { runPackCreate } = await import("./cmd/pack-create");
    await runPackCreate(id, {
      template: fromIdx >= 0 ? Bun.argv[fromIdx + 1] : undefined,
      description: descIdx >= 0 ? Bun.argv[descIdx + 1] : undefined,
      global: Bun.argv.includes("--global"),
    });
  } else {
    console.error("Usage: orkestrate pack <list|install|validate|create>");
    process.exit(1);
  }
} else if (command === "run") {
  const sub = Bun.argv[3];
  if (sub === "launch" || sub === "spawn") {
    const packId = Bun.argv[4];
    if (!packId) {
      console.error(`Usage: orkestrate run ${sub} <pack-id>`);
      process.exit(1);
    }
    const { runLaunch, runSpawn } = await import("./cmd/run");
    if (sub === "spawn") await runSpawn(packId);
    else await runLaunch(packId);
  } else if (sub === "list") {
    const { runList } = await import("./cmd/run");
    await runList();
  } else if (sub === "status") {
    const id = Bun.argv[4];
    if (!id) {
      console.error("Usage: orkestrate run status <run-id>");
      process.exit(1);
    }
    const { runStatus } = await import("./cmd/run");
    await runStatus(id);
  } else if (sub === "stop") {
    const id = Bun.argv[4];
    if (!id) {
      console.error("Usage: orkestrate run stop <run-id>");
      process.exit(1);
    }
    const { runStop } = await import("./cmd/run");
    await runStop(id);
  } else {
    console.error("Usage: orkestrate run <launch|spawn|list|status|stop>");
    process.exit(1);
  }
} else if (command === "profile") {
  const sub = Bun.argv[3];
  if (sub === "validate") {
    const name = Bun.argv[4];
    if (!name) {
      console.error("Usage: orkestrate profile validate <pack-id>");
      process.exit(1);
    }
    const { runPackValidate } = await import("./cmd/pack");
    await runPackValidate(name);
  } else if (sub === "create") {
    console.error("Use: orkestrate pack create <pack-id> [--from coding] [--global]");
    process.exit(1);
  } else {
    console.error("Profile commands are deprecated. Use: orkestrate pack … / orkestrate run …");
    process.exit(1);
  }
} else if (command === "registry") {
  const subCommand = Bun.argv[3];
  if (subCommand === "list") {
    const { runRegistryList } = await import("./cmd/registry");
    await runRegistryList();
  } else if (subCommand === "search") {
    const query = Bun.argv[4];
    if (!query) {
      console.error("Usage: orkestrate registry search <query>");
      process.exit(1);
    }
    const { runRegistrySearch } = await import("./cmd/registry");
    await runRegistrySearch(query);
  } else if (subCommand === "install") {
    const slug = Bun.argv[4];
    if (!slug) {
      console.error("Usage: orkestrate registry install <slug> [--global] [--overwrite]");
      process.exit(1);
    }
    const { runRegistryInstall } = await import("./cmd/registry");
    await runRegistryInstall(slug, {
      global: Bun.argv.includes("--global"),
      overwrite: Bun.argv.includes("--overwrite"),
    });
  } else {
    console.error("Usage: orkestrate registry <list|search|install>");
    process.exit(1);
  }
} else if (command === "extension" && Bun.argv[3] === "validate") {
  const target = Bun.argv[4];
  if (!target) {
    console.error("Usage: orkestrate extension validate <path>");
    process.exit(1);
  }
  const { resolve } = await import("node:path");
  try {
    const mod = await import(resolve(target));
    const ext = mod.default || mod.extension || mod;
    console.log("Extension valid:", ext.id, ext.version);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
} else {
  console.log(`Orkestrate v${VERSION}`);
  console.log("Commands:");
  console.log("  orkestrate              TUI workbench");
  console.log("  orkestrate pack list|install|validate|create");
  console.log("  orkestrate registry list|search|install");
  console.log("  orkestrate run launch|spawn|list|status|stop");
  console.log("  orkestrate doctor");
}