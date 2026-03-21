/**
 * Orkestrate CLI — Terminal UI Helpers
 *
 * Pretty output formatting for the terminal.
 */

import pc from "picocolors";

export const ui = {
  // Status icons
  success: (msg: string) => console.log(`  ${pc.green("✓")} ${msg}`),
  error: (msg: string) => console.log(`  ${pc.red("✗")} ${msg}`),
  info: (msg: string) => console.log(`  ${pc.blue("→")} ${msg}`),
  warn: (msg: string) => console.log(`  ${pc.yellow("!")} ${msg}`),
  dim: (msg: string) => console.log(`  ${pc.dim(msg)}`),

  // Headers
  header: (msg: string) => {
    console.log();
    console.log(`  ${pc.bold(pc.white(msg))}`);
    console.log();
  },

  // Blank line
  blank: () => console.log(),

  // Indented line
  line: (msg: string) => console.log(`  ${msg}`),

  // Key-value pair
  kv: (key: string, value: string) => {
    console.log(`  ${pc.dim(key + ":")} ${value}`);
  },

  // Table
  table: (headers: string[], rows: string[][]) => {
    const colWidths = headers.map((h, i) => {
      const maxContent = Math.max(h.length, ...rows.map((r) => (r[i] || "").length));
      return Math.min(maxContent, 40);
    });

    const separator = "─";
    const pad = (s: string, w: number) => s.padEnd(w).slice(0, w);

    // Top border
    console.log(
      `  ┌${colWidths.map((w) => separator.repeat(w + 2)).join("┬")}┐`,
    );

    // Header row
    console.log(
      `  │${headers.map((h, i) => ` ${pc.bold(pad(h, colWidths[i]))} `).join("│")}│`,
    );

    // Header separator
    console.log(
      `  ├${colWidths.map((w) => separator.repeat(w + 2)).join("┼")}┤`,
    );

    // Data rows
    for (const row of rows) {
      console.log(
        `  │${row.map((c, i) => ` ${pad(c || "", colWidths[i])} `).join("│")}│`,
      );
    }

    // Bottom border
    console.log(
      `  └${colWidths.map((w) => separator.repeat(w + 2)).join("┴")}┘`,
    );
  },

  // Colored status badge
  statusBadge: (status: string): string => {
    switch (status) {
      case "active":
        return pc.green("● active");
      case "idle":
        return pc.dim("○ idle");
      case "blocked":
        return pc.red("■ blocked");
      case "planning":
        return pc.blue("◆ planning");
      case "handoff":
        return pc.yellow("⇄ handoff");
      case "done":
        return pc.dim("✓ done");
      default:
        return pc.dim(status);
    }
  },

  // Interactive prompts
  confirm: async (question: string, defaultYes = true): Promise<boolean> => {
    const { createInterface } = await import("node:readline/promises");
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const suffix = defaultYes ? "[Y/n]" : "[y/N]";
    const answer = await rl.question(`  ${pc.bold(pc.white(question))} ${pc.dim(suffix)} `);
    rl.close();
    if (!answer) return defaultYes;
    return answer.toLowerCase().startsWith("y");
  },

  input: async (question: string, defaultValue?: string): Promise<string> => {
    const { createInterface } = await import("node:readline/promises");
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const suffix = defaultValue ? pc.dim(` (${defaultValue})`) : "";
    const answer = await rl.question(`  ${pc.bold(pc.white(question))}${suffix} `);
    rl.close();
    return answer || defaultValue || "";
  },

  // Banner
  banner: () => {
    console.log();
    console.log(pc.bold(pc.cyan("  ⬡ orkestrate")));
    console.log(pc.dim("  the coordination layer for AI coding agents"));
    console.log();
  },
};
