import { runPackValidate } from "./pack";

export async function runProfileValidate(name: string): Promise<void> {
  await runPackValidate(name);
}