import { mkdir, readFile, writeFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
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
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(comparisonId)) {
    throw new Error(
      "comparisonId must be a non-empty slug containing only letters, numbers, underscores, and hyphens.",
    );
  }

  const root = resolve(".trace-inspector", "comparisons");
  const directory = resolve(root, comparisonId);
  const relativeDirectory = relative(root, directory);
  if (
    isAbsolute(relativeDirectory) ||
    (relativeDirectory !== "" && relativeDirectory.startsWith(`..${sep}`))
  ) {
    throw new Error("comparisonId resolves outside the comparisons directory.");
  }

  const storedDirectory = join(".trace-inspector", "comparisons", comparisonId);

  return {
    directory: storedDirectory,
    diff: join(storedDirectory, "diff.json"),
    intervention: join(storedDirectory, "intervention.json"),
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
