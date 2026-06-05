export type LaunchPlan = {
  command: string;
  args: string[];
  cwd: string;
  env: Record<string, string>;
  title: string;
};