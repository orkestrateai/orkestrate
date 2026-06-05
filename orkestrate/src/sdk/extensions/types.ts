import type { HarnessDriver } from "../types";

export interface ExtensionContext {
  registerAdapter(harness: string, adapter: HarnessDriver): void;
}

export interface OrkExtension {
  id: string;
  name: string;
  version: string;
  activate(ctx: ExtensionContext): void | Promise<void>;
}
