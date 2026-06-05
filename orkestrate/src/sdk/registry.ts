import type { HarnessDriver } from "./types";

class ExtensionRegistry {
  private adapters = new Map<string, HarnessDriver>();

  registerAdapter(harness: string, adapter: HarnessDriver): void {
    this.adapters.set(harness, adapter);
  }

  getAdapter(harness: string): HarnessDriver | undefined {
    return this.adapters.get(harness);
  }

}

export const registry = new ExtensionRegistry();

// Convenience alias for direct use outside extensions
export const getAdapter = registry.getAdapter.bind(registry);
