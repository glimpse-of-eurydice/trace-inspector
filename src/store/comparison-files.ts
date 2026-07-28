import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  InterventionManifest,
  TraceDiff,
} from "../core/trace-comparison.js";

export interface ComparisonPaths {
  directory: string;
  diff: string;
  intervention: string;
}

export function comparisonPaths(comparisonId: string): ComparisonPaths {
  const directory = join(".trace-inspector", "comparisons", comparisonId);

  return {
    directory,
    diff: join(directory, "diff.json"),
    intervention: join(directory, "intervention.json"),
  };
}

export async function createComparisonDirectory(
  comparisonId: string,
): Promise<ComparisonPaths> {
  const paths = comparisonPaths(comparisonId);
  await mkdir(paths.directory, { recursive: true });
  return paths;
}

export async function writeTraceDiff(
  file: string,
  diff: TraceDiff,
): Promise<void> {
  await writeFile(file, `${JSON.stringify(diff, null, 2)}\n`, "utf8");
}

export async function readInterventionManifest(
  file: string,
): Promise<InterventionManifest> {
  return JSON.parse(await readFile(file, "utf8")) as InterventionManifest;
}

export async function writeInterventionManifest(
  file: string,
  manifest: InterventionManifest,
): Promise<void> {
  await writeFile(file, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}
