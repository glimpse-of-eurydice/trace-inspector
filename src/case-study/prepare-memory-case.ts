import { createHash } from "node:crypto";
import {
  copyFile,
  mkdir,
  readFile,
  writeFile,
} from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";

export const MEMORY_CASE_MANIFEST_PATH =
  "fixtures/case-studies/memory-agent/case-manifest.json";

export type MemoryConditionId = "M1" | "M2" | "M3";

interface ArtifactReference {
  path: string;
  sourcePath?: string;
  sha256: string;
}

interface ConditionReference {
  conditionId: MemoryConditionId;
  label: string;
  sourcePath: string;
  installedPath: string;
  sha256: string;
}

interface MemoryCaseManifest {
  schemaVersion: string;
  caseStudyId: string;
  fixtureVersion: string;
  intervention: {
    conditions: ConditionReference[];
  };
  heldVariables: {
    task: ArtifactReference;
    sharedWorkspace: ArtifactReference[];
  };
  materializedWorkspace: {
    requiredFiles: string[];
    initialWritableFile: string;
  };
}

export interface PrepareMemoryCaseOptions {
  conditionId: string;
  repositoryRoot?: string;
  outputDirectory?: string;
  preparedAt?: Date;
}

export interface PreparedMemoryCase {
  caseStudyId: string;
  conditionId: MemoryConditionId;
  conditionLabel: string;
  preparedDirectory: string;
  workspaceDirectory: string;
  localRunManifest: string;
  initialChecksums: Record<string, string>;
}

interface LocalRunManifest {
  schemaVersion: string;
  kind: "prepared-memory-case";
  status: "prepared-not-run";
  caseStudyId: string;
  caseFixtureVersion: string;
  caseManifest: string;
  conditionId: MemoryConditionId;
  conditionLabel: string;
  preparedAt: string;
  workspaceDirectory: "workspace";
  taskPromptFile: "task.md";
  assignedMemoryFile: "memory.md";
  allowedWritableFiles: ["proposal.md"];
  initialChecksums: Record<string, string>;
}

function normalizeConditionId(value: string): MemoryConditionId {
  const normalized = value.trim().toUpperCase();

  if (normalized === "M1" || normalized === "M2" || normalized === "M3") {
    return normalized;
  }

  throw new Error(
    `Unknown memory condition "${value}". Expected one of: M1, M2, M3.`,
  );
}

function resolveInside(baseDirectory: string, relativePath: string): string {
  if (isAbsolute(relativePath)) {
    throw new Error(`Expected a relative path, received: ${relativePath}`);
  }

  const resolvedBase = resolve(baseDirectory);
  const resolvedPath = resolve(resolvedBase, relativePath);
  const pathFromBase = relative(resolvedBase, resolvedPath);

  if (
    pathFromBase === ".." ||
    pathFromBase.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`)
  ) {
    throw new Error(`Path escapes its allowed directory: ${relativePath}`);
  }

  return resolvedPath;
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

async function sha256(path: string): Promise<string> {
  return createHash("sha256")
    .update(await readFile(path))
    .digest("hex");
}

async function verifyChecksum(
  path: string,
  expected: string,
  label: string,
): Promise<void> {
  const actual = await sha256(path);

  if (actual !== expected) {
    throw new Error(
      `${label} checksum mismatch. Expected ${expected}, received ${actual}.`,
    );
  }
}

function defaultRunId(
  conditionId: MemoryConditionId,
  preparedAt: Date,
): string {
  const timestamp = preparedAt
    .toISOString()
    .replace(/\.\d{3}Z$/, "Z")
    .replace(/[-:]/g, "")
    .replace("T", "-");

  return `${conditionId}-${timestamp}`;
}

export async function prepareMemoryCaseWorkspace(
  options: PrepareMemoryCaseOptions,
): Promise<PreparedMemoryCase> {
  const repositoryRoot = resolve(options.repositoryRoot ?? process.cwd());
  const conditionId = normalizeConditionId(options.conditionId);
  const preparedAt = options.preparedAt ?? new Date();
  const caseManifestPath = resolveInside(
    repositoryRoot,
    MEMORY_CASE_MANIFEST_PATH,
  );
  const caseManifest =
    await readJson<MemoryCaseManifest>(caseManifestPath);
  const condition = caseManifest.intervention.conditions.find(
    (candidate) => candidate.conditionId === conditionId,
  );

  if (condition === undefined) {
    throw new Error(
      `Condition ${conditionId} is not declared in ${MEMORY_CASE_MANIFEST_PATH}.`,
    );
  }

  const preparedDirectory =
    options.outputDirectory === undefined
      ? resolveInside(
          repositoryRoot,
          `.trace-inspector/case-studies/memory-agent/prepared/${defaultRunId(conditionId, preparedAt)}`,
        )
      : resolve(options.outputDirectory);
  const workspaceDirectory = resolve(preparedDirectory, "workspace");
  const localRunManifest = resolve(preparedDirectory, "run-manifest.json");

  await mkdir(dirname(preparedDirectory), { recursive: true });
  await mkdir(preparedDirectory, { recursive: false });
  await mkdir(workspaceDirectory, { recursive: false });

  const taskSource = resolveInside(
    repositoryRoot,
    caseManifest.heldVariables.task.path,
  );
  const taskTarget = resolveInside(workspaceDirectory, "task.md");

  await verifyChecksum(
    taskSource,
    caseManifest.heldVariables.task.sha256,
    "Task fixture",
  );
  await copyFile(taskSource, taskTarget);

  for (const artifact of caseManifest.heldVariables.sharedWorkspace) {
    const sourcePath = resolveInside(
      repositoryRoot,
      artifact.sourcePath ?? artifact.path,
    );
    const targetPath = resolveInside(workspaceDirectory, artifact.path);

    await verifyChecksum(sourcePath, artifact.sha256, artifact.path);
    await mkdir(dirname(targetPath), { recursive: true });
    await copyFile(sourcePath, targetPath);
  }

  const memorySource = resolveInside(repositoryRoot, condition.sourcePath);
  const memoryTarget = resolveInside(
    workspaceDirectory,
    condition.installedPath,
  );

  await verifyChecksum(
    memorySource,
    condition.sha256,
    `${conditionId} representation`,
  );
  await copyFile(memorySource, memoryTarget);

  const initialChecksums: Record<string, string> = {};

  for (const file of caseManifest.materializedWorkspace.requiredFiles) {
    initialChecksums[file] = await sha256(
      resolveInside(workspaceDirectory, file),
    );
  }

  if (initialChecksums["memory.md"] !== condition.sha256) {
    throw new Error(`${conditionId} was not installed at memory.md correctly.`);
  }

  const runManifest: LocalRunManifest = {
    schemaVersion: "0.1",
    kind: "prepared-memory-case",
    status: "prepared-not-run",
    caseStudyId: caseManifest.caseStudyId,
    caseFixtureVersion: caseManifest.fixtureVersion,
    caseManifest: MEMORY_CASE_MANIFEST_PATH,
    conditionId,
    conditionLabel: condition.label,
    preparedAt: preparedAt.toISOString(),
    workspaceDirectory: "workspace",
    taskPromptFile: "task.md",
    assignedMemoryFile: "memory.md",
    allowedWritableFiles: ["proposal.md"],
    initialChecksums,
  };

  await writeFile(
    localRunManifest,
    `${JSON.stringify(runManifest, null, 2)}\n`,
    "utf8",
  );

  return {
    caseStudyId: caseManifest.caseStudyId,
    conditionId,
    conditionLabel: condition.label,
    preparedDirectory,
    workspaceDirectory,
    localRunManifest,
    initialChecksums,
  };
}
