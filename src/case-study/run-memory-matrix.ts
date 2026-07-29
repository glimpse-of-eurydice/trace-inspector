import { execFile as execFileCallback } from "node:child_process";
import {
  mkdir,
  readFile,
  readdir,
  writeFile,
} from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";
import { resolveCodexBinary } from "../collector/resolve-codex-binary.js";
import type { CodexRuntimeMetadata } from "../core/codex-runtime-metadata.js";
import {
  MEMORY_CASE_APPROVAL_POLICY,
  MEMORY_CASE_MODEL,
  MEMORY_CASE_REASONING_EFFORT,
  MEMORY_CASE_SANDBOX_TYPE,
} from "./memory-case-runtime.js";
import {
  runMemoryCase,
  type MemoryCaseRunResult,
} from "./run-memory-case.js";

const execFile = promisify(execFileCallback);

export const MEMORY_MATRIX_ORDER = [
  "M1-R1",
  "M2-R1",
  "M3-R1",
  "M2-R2",
  "M3-R2",
  "M1-R2",
  "M3-R3",
  "M1-R3",
  "M2-R3",
] as const;

export type MemoryMatrixRunId = (typeof MEMORY_MATRIX_ORDER)[number];

interface CaseManifestForPreflight {
  status: string;
  runPlan: {
    repeatsPerCondition: number;
    totalRuns: number;
    interleavedOrder: string[];
    retryPolicy: string;
  };
  heldVariables: {
    runtimeControls: {
      model: string;
      reasoningEffort: string;
      approvalPolicy: string;
      network: string;
    };
  };
}

export interface MemoryMatrixPreflight {
  checkedAt: string;
  passed: boolean;
  repositoryCommit: string;
  worktreeClean: boolean;
  codexBinaryVersion: string;
  caseManifestStatus: string;
  declaredOrder: string[];
  expectedOrder: string[];
  existingOfficialRunIds: string[];
  checks: Array<{
    name: string;
    passed: boolean;
    detail: string;
  }>;
  outputFile: string;
}

export interface MatrixRunSummary {
  runId: string;
  attempted: boolean;
  orchestrationError: string | null;
  traceId: string | null;
  traceStatus: string | null;
  collectorError: string | null;
  exposureStatus: string | null;
  proposalNonBlank: boolean | null;
  unexpectedChangedFiles: string[];
  runtimeAuditPassed: boolean | null;
  passedStructuralChecks: boolean | null;
  runtime: CodexRuntimeMetadata | null;
  runManifest: string | null;
}

export interface RuntimeConsistencyAudit {
  passed: boolean;
  baselineRunId: string | null;
  fields: string[];
  mismatches: string[];
}

export interface MemoryMatrixManifest {
  schemaVersion: "0.1";
  kind: "memory-case-run-matrix";
  status: "running" | "completed" | "completed-with-failures";
  startedAt: string;
  endedAt: string | null;
  repositoryCommit: string;
  predeclaredOrder: readonly string[];
  noSilentRetry: true;
  expectedRuntime: {
    model: string;
    reasoningEffort: string;
    approvalPolicy: string;
    sandboxType: string;
    networkAccess: false;
  };
  runs: MatrixRunSummary[];
  attemptedRunCount: number;
  allRunsAttempted: boolean;
  allStructuralChecksPassed: boolean;
  runtimeConsistency: RuntimeConsistencyAudit | null;
}

export interface RunMemoryMatrixOptions {
  repositoryRoot?: string;
  timeoutMs?: number;
  onRunStart?: (runId: MemoryMatrixRunId, index: number) => void;
  onRunComplete?: (
    runId: MemoryMatrixRunId,
    index: number,
    summary: MatrixRunSummary,
  ) => void;
}

function runParts(
  runId: MemoryMatrixRunId,
): { conditionId: string; repeatId: string } {
  const [conditionId, repeatId] = runId.split("-");

  if (conditionId === undefined || repeatId === undefined) {
    throw new Error(`Invalid matrix run id: ${runId}`);
  }

  return { conditionId, repeatId };
}

async function readGitState(
  repositoryRoot: string,
): Promise<{ commit: string; clean: boolean }> {
  const [{ stdout: commit }, { stdout: status }] = await Promise.all([
    execFile("git", ["rev-parse", "HEAD"], { cwd: repositoryRoot }),
    execFile("git", ["status", "--porcelain"], { cwd: repositoryRoot }),
  ]);

  return {
    commit: commit.trim(),
    clean: status.trim() === "",
  };
}

async function existingOfficialRunIds(runRoot: string): Promise<string[]> {
  try {
    const entries = await readdir(runRoot, { withFileTypes: true });
    return entries
      .filter(
        (entry) =>
          entry.isDirectory() &&
          MEMORY_MATRIX_ORDER.includes(entry.name as MemoryMatrixRunId),
      )
      .map((entry) => entry.name)
      .sort();
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? error.code
        : undefined;

    if (code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

export async function preflightMemoryMatrix(
  repositoryRootInput = process.cwd(),
): Promise<MemoryMatrixPreflight> {
  const repositoryRoot = resolve(repositoryRootInput);
  const caseManifestPath = resolve(
    repositoryRoot,
    "fixtures",
    "case-studies",
    "memory-agent",
    "case-manifest.json",
  );
  const runRoot = resolve(
    repositoryRoot,
    ".trace-inspector",
    "case-studies",
    "memory-agent",
    "runs",
  );
  const outputFile = resolve(
    repositoryRoot,
    ".trace-inspector",
    "case-studies",
    "memory-agent",
    "preflight.json",
  );
  const caseManifest = JSON.parse(
    await readFile(caseManifestPath, "utf8"),
  ) as CaseManifestForPreflight;
  const git = await readGitState(repositoryRoot);
  const codexBinary = await resolveCodexBinary();
  const { stdout: codexVersionOutput } = await execFile(
    codexBinary,
    ["--version"],
    { cwd: repositoryRoot },
  );
  const codexBinaryVersion = codexVersionOutput.trim();
  const existingRunIds = await existingOfficialRunIds(runRoot);
  const expectedOrder = [...MEMORY_MATRIX_ORDER];
  const declaredOrder = caseManifest.runPlan.interleavedOrder;
  const checks = [
    {
      name: "clean-worktree",
      passed: git.clean,
      detail: git.clean
        ? `Repository is clean at ${git.commit}.`
        : "Repository has tracked or untracked changes.",
    },
    {
      name: "frozen-case-manifest",
      passed: caseManifest.status === "frozen-before-agent-runs",
      detail: `Observed status: ${caseManifest.status}.`,
    },
    {
      name: "predeclared-order",
      passed:
        JSON.stringify(declaredOrder) === JSON.stringify(expectedOrder) &&
        caseManifest.runPlan.totalRuns === MEMORY_MATRIX_ORDER.length &&
        caseManifest.runPlan.repeatsPerCondition === 3,
      detail: `Declared ${declaredOrder.length} runs; expected ${expectedOrder.length}.`,
    },
    {
      name: "no-existing-official-runs",
      passed: existingRunIds.length === 0,
      detail:
        existingRunIds.length === 0
          ? "No official run directory collides with the matrix."
          : `Existing run ids: ${existingRunIds.join(", ")}.`,
    },
    {
      name: "runtime-controls-frozen",
      passed:
        caseManifest.heldVariables.runtimeControls.model ===
          MEMORY_CASE_MODEL &&
        caseManifest.heldVariables.runtimeControls.reasoningEffort ===
          MEMORY_CASE_REASONING_EFFORT &&
        caseManifest.heldVariables.runtimeControls.approvalPolicy ===
          MEMORY_CASE_APPROVAL_POLICY &&
        caseManifest.heldVariables.runtimeControls.network ===
          "disabled by sandbox policy",
      detail: `${MEMORY_CASE_MODEL} / ${MEMORY_CASE_REASONING_EFFORT} / ${MEMORY_CASE_APPROVAL_POLICY} / network disabled.`,
    },
    {
      name: "codex-binary",
      passed: /^codex-cli\s+\S+/.test(codexBinaryVersion),
      detail: codexBinaryVersion,
    },
  ];
  const preflight: MemoryMatrixPreflight = {
    checkedAt: new Date().toISOString(),
    passed: checks.every((check) => check.passed),
    repositoryCommit: git.commit,
    worktreeClean: git.clean,
    codexBinaryVersion,
    caseManifestStatus: caseManifest.status,
    declaredOrder,
    expectedOrder,
    existingOfficialRunIds: existingRunIds,
    checks,
    outputFile,
  };

  await mkdir(dirname(outputFile), { recursive: true });
  await writeFile(outputFile, `${JSON.stringify(preflight, null, 2)}\n`);
  return preflight;
}

function runtimeSignature(runtime: CodexRuntimeMetadata): Record<string, unknown> {
  return {
    cliVersion: runtime.cliVersion,
    model: runtime.model,
    modelProvider: runtime.modelProvider,
    serviceTier: runtime.serviceTier,
    reasoningEffort: runtime.reasoningEffort,
    approvalPolicy: runtime.approvalPolicy,
    sandboxType: runtime.sandbox?.type ?? null,
    networkAccess: runtime.sandbox?.networkAccess ?? null,
  };
}

export function auditRuntimeConsistency(
  runs: MatrixRunSummary[],
): RuntimeConsistencyAudit {
  const fields = [
    "cliVersion",
    "model",
    "modelProvider",
    "serviceTier",
    "reasoningEffort",
    "approvalPolicy",
    "sandboxType",
    "networkAccess",
  ];
  const withRuntime = runs.filter(
    (run): run is MatrixRunSummary & { runtime: CodexRuntimeMetadata } =>
      run.runtime !== null,
  );
  const baseline = withRuntime[0];

  if (baseline === undefined) {
    return {
      passed: false,
      baselineRunId: null,
      fields,
      mismatches: ["No run exposed runtime metadata."],
    };
  }

  const expected = runtimeSignature(baseline.runtime);
  const mismatches: string[] = [];

  for (const run of withRuntime.slice(1)) {
    const observed = runtimeSignature(run.runtime);

    for (const field of fields) {
      if (observed[field] !== expected[field]) {
        mismatches.push(
          `${run.runId}.${field}: expected ${String(expected[field])}, observed ${String(observed[field])}`,
        );
      }
    }
  }

  if (withRuntime.length !== runs.length) {
    mismatches.push(
      `${runs.length - withRuntime.length} run(s) lacked runtime metadata.`,
    );
  }

  return {
    passed: mismatches.length === 0,
    baselineRunId: baseline.runId,
    fields,
    mismatches,
  };
}

function summarizeRun(result: MemoryCaseRunResult): MatrixRunSummary {
  return {
    runId: result.runId,
    attempted: true,
    orchestrationError: null,
    traceId: result.trace.traceId,
    traceStatus: result.trace.status,
    collectorError: result.trace.collectorError,
    exposureStatus: result.exposure.status,
    proposalNonBlank: result.workspaceAudit.proposalNonBlank,
    unexpectedChangedFiles: result.workspaceAudit.unexpectedChangedFiles,
    runtimeAuditPassed: result.runtimeAudit.passed,
    passedStructuralChecks: result.passedStructuralChecks,
    runtime: result.trace.runtime,
    runManifest: result.runManifest,
  };
}

export async function runMemoryMatrix(
  options: RunMemoryMatrixOptions = {},
): Promise<MemoryMatrixManifest> {
  const repositoryRoot = resolve(options.repositoryRoot ?? process.cwd());
  const preflight = await preflightMemoryMatrix(repositoryRoot);

  if (!preflight.passed) {
    const failures = preflight.checks
      .filter((check) => !check.passed)
      .map((check) => `${check.name}: ${check.detail}`)
      .join("\n");
    throw new Error(`Memory matrix preflight failed:\n${failures}`);
  }

  const matrixPath = resolve(
    repositoryRoot,
    ".trace-inspector",
    "case-studies",
    "memory-agent",
    "matrix-manifest.json",
  );
  const manifest: MemoryMatrixManifest = {
    schemaVersion: "0.1",
    kind: "memory-case-run-matrix",
    status: "running",
    startedAt: new Date().toISOString(),
    endedAt: null,
    repositoryCommit: preflight.repositoryCommit,
    predeclaredOrder: MEMORY_MATRIX_ORDER,
    noSilentRetry: true,
    expectedRuntime: {
      model: MEMORY_CASE_MODEL,
      reasoningEffort: MEMORY_CASE_REASONING_EFFORT,
      approvalPolicy: MEMORY_CASE_APPROVAL_POLICY,
      sandboxType: MEMORY_CASE_SANDBOX_TYPE,
      networkAccess: false,
    },
    runs: [],
    attemptedRunCount: 0,
    allRunsAttempted: false,
    allStructuralChecksPassed: false,
    runtimeConsistency: null,
  };

  await writeFile(matrixPath, `${JSON.stringify(manifest, null, 2)}\n`);

  for (const [index, runId] of MEMORY_MATRIX_ORDER.entries()) {
    options.onRunStart?.(runId, index);
    const { conditionId, repeatId } = runParts(runId);
    let summary: MatrixRunSummary;

    try {
      const result = await runMemoryCase({
        conditionId,
        repeatId,
        repositoryRoot,
        timeoutMs: options.timeoutMs,
      });
      summary = summarizeRun(result);
    } catch (error) {
      summary = {
        runId,
        attempted: true,
        orchestrationError:
          error instanceof Error ? error.message : String(error),
        traceId: null,
        traceStatus: null,
        collectorError: null,
        exposureStatus: null,
        proposalNonBlank: null,
        unexpectedChangedFiles: [],
        runtimeAuditPassed: null,
        passedStructuralChecks: null,
        runtime: null,
        runManifest: null,
      };
    }

    manifest.runs.push(summary);
    manifest.attemptedRunCount = manifest.runs.length;
    options.onRunComplete?.(runId, index, summary);
    await writeFile(matrixPath, `${JSON.stringify(manifest, null, 2)}\n`);
  }

  manifest.endedAt = new Date().toISOString();
  manifest.allRunsAttempted =
    manifest.attemptedRunCount === MEMORY_MATRIX_ORDER.length;
  manifest.allStructuralChecksPassed = manifest.runs.every(
    (run) => run.passedStructuralChecks === true,
  );
  manifest.runtimeConsistency = auditRuntimeConsistency(manifest.runs);
  manifest.status =
    manifest.allRunsAttempted &&
    manifest.allStructuralChecksPassed &&
    manifest.runtimeConsistency.passed
      ? "completed"
      : "completed-with-failures";
  await writeFile(matrixPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}
