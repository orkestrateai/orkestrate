import type { HarnessDriver, HarnessStatus, CompileContext } from "../../src/sdk/types";
import type { Pack } from "../../src/sdk/packs/schema";
import type { LaunchPlan } from "../../src/sdk/launch/types";
import type { OrkExtension } from "../../src/sdk/extensions/types";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { spawnSync } from "bun";
import { harnessSliceDir } from "../../src/sdk/packs/paths";
import { seedHarnessSlice } from "../../src/sdk/harness/sync-slice";

async function pathExists(path: string): Promise<boolean> {
  try {
    await Bun.file(path).exists();
    return true;
  } catch {
    return false;
  }
}

async function applyHarnessSlice(pack: Pack, opencodeConfigDir: string): Promise<string> {
  const slice = harnessSliceDir(pack.packRoot, "opencode");
  if (!(await pathExists(slice))) {
    throw new Error(`Pack is missing harnesses/opencode/ slice`);
  }
  await mkdir(opencodeConfigDir, { recursive: true });
  await seedHarnessSlice(slice, opencodeConfigDir);
  return opencodeConfigDir;
}

export const opencodeDriver: HarnessDriver = {
  id: "opencode",
  name: "OpenCode",

  async detect(): Promise<HarnessStatus> {
    try {
      const proc = spawnSync(["opencode", "--version"], { stdout: "pipe", stderr: "pipe" });
      if (!proc.success) {
        return { installed: false, error: proc.stderr.toString().trim() || "opencode --version failed" };
      }
      return { installed: true, version: proc.stdout.toString().trim() || undefined };
    } catch (error) {
      return { installed: false, error: error instanceof Error ? error.message : String(error) };
    }
  },

  async compile(pack: Pack, context: CompileContext): Promise<LaunchPlan> {
    if (pack.harness !== "opencode") {
      throw new Error(`Pack "${pack.id}" is not an OpenCode pack`);
    }

    // One home per pack in this workspace — OpenCode sessions persist across launches.
    // Env is only set on the Orkestrate-spawned process; the user's normal OpenCode is untouched.
    const profileHome = context.packHome;
    const profileConfigHome = join(profileHome, ".config");
    const profileDataHome = join(profileHome, ".local", "share");
    const profileStateHome = join(profileHome, ".local", "state");
    const profileCacheHome = join(profileHome, ".cache");
    const opencodeConfigDir = join(profileConfigHome, "opencode");

    await applyHarnessSlice(pack, opencodeConfigDir);

    let defaultAgent = pack.id;
    const configPath = join(opencodeConfigDir, "opencode.json");
    if (await pathExists(configPath)) {
      try {
        const config = await Bun.file(configPath).json();
        if (typeof config.default_agent === "string") {
          defaultAgent = config.default_agent;
        }
      } catch {
        // use pack id
      }
    }

    const env: Record<string, string> = {
      ...Object.fromEntries(
        Object.entries(process.env).filter(([, v]) => v !== undefined) as [string, string][]
      ),
      ...context.crossPlatform.hijackHome(profileHome),
      XDG_CONFIG_HOME: profileConfigHome,
      XDG_DATA_HOME: profileDataHome,
      XDG_STATE_HOME: profileStateHome,
      XDG_CACHE_HOME: profileCacheHome,
      OPENCODE_CONFIG_DIR: opencodeConfigDir,
    };

    return {
      command: "opencode",
      args: ["--agent", defaultAgent],
      cwd: context.cwd,
      env,
      title: `orkestrate: ${pack.id}`,
    };
  },
};

export const extension: OrkExtension = {
  id: "orkestrate.driver.opencode",
  name: "OpenCode Driver",
  version: "0.2.0",
  activate(ctx) {
    ctx.registerAdapter("opencode", opencodeDriver);
  },
};

export default extension;