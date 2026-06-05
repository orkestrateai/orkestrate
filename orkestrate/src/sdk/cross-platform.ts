import type { CrossPlatformUtility } from "./types";
import * as path from "path";

export const crossPlatformUtility: CrossPlatformUtility = {
  hijackHome(fakeHomePath: string): Record<string, string> {
    const isWindowsPath = fakeHomePath.includes(":\\") || fakeHomePath.includes(":/");
    
    const envVars: Record<string, string> = {
      HOME: fakeHomePath,
      USERPROFILE: fakeHomePath,
      APPDATA: fakeHomePath,
      XDG_CONFIG_HOME: path.join(fakeHomePath, ".config"),
      XDG_DATA_HOME: path.join(fakeHomePath, ".local", "share"),
      XDG_STATE_HOME: path.join(fakeHomePath, ".local", "state"),
      XDG_CACHE_HOME: path.join(fakeHomePath, ".cache"),
    };

    if (isWindowsPath) {
      envVars.HOMEDRIVE = fakeHomePath.substring(0, 2);
      envVars.HOMEPATH = fakeHomePath.substring(2);
    }

    return envVars;
  }
};
