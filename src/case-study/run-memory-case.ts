import { createHash } from "node:crypto";
import {
  appendFile,
  mkdir,
  readFile,
  writeFile,
} from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import {
  recordCodexTurn,
  type RecordCodexTurnOptions,
  type RecordCodexTurnResult,
} from "../collector/codex-app-server.js";
import type { TraceEvent } from "../core/trace-event.js";
import {
  replayTrace,
  type ReplayResult,
} from "../replay/replay-trace.js";
import {
  prepareMemoryCaseWorkspace,
  type MemoryConditionId,
  type PreparedMemoryCase,
} from "./prepare-memory-case.js";
import {
  auditMemoryCaseRuntime,
  MEMORY_CASE_MODEL,
  MEMORY_CASE_REASONING_EFFORT,
  type RuntimeAudit,
} from "./memory-case-runtime.js";

export type MemoryRepeatId = "R1" | "R2" | "R3";
export type MemoryExposureStatus =
  | "exposed"
  | "not_exposed"
  | "ambiguous";

interface ExistingPreparedManifest {
  schemaVersion: string;
  kind: "prepared-memory-case";
  status: "prepared-not-run" | "run-completed" | "run-recorded";
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

export interface MemoryExposureResult {
  status: MemoryExposureStatus;
  startedEventIds: string[];
  completedEventIds: string[];
  firstCompletedSequence?: number;
  rule: string;
}

export interface WorkspaceAudit {
  changedFiles: string[];
  unchangedFiles: string[];
  unexpectedChangedFiles: string[];
  missingFiles: string[];
  proposalWritten: boolean;
  proposalNonBlank: boolean;
  finalChecksums: Record<string, string | null>;
}

export interface RunMemoryCaseOptions {
  conditionId: string;
  repeatId: string;
  repositoryRoot?: string;
  outputDirectory?: string;
  runLedgerPath?: string;
  timeoutMs?: number;
  now?: Date;
}

export interface RunMemoryCaseDependencies {
  recordTurn?: (
    options: RecordCodexTurnOptions,
  ) => Promise<RecordCodexTurnResult>;
  replay?: (traceId: string) => Promise<ReplayResult>;
}

export interface MemoryCaseRunResult {
  runId: string;
  conditionId: MemoryConditionId;
  repeatId: MemoryRepeatId;
  prepared: PreparedMemoryCase;
  trace: RecordCodexTurnResult;
  exposure: MemoryExposureResult;
  workspaceAudit: WorkspaceAudit;
  runtimeAudit: RuntimeAudit;
  passedStructuralChecks: boolean;
  runManifest: string;
  runLedger: string;
}

interface CompletedRunManifest extends ExistingPreparedManifest {
  status: "run-recorded";
  runId: string;
  repeatId: MemoryRepeatId;
  endedAt: string;
  trace: {
    traceId: string;
    status: RecordCodexTurnResult["status"];
    eventCount: number;
    traceDirectory: string;
    collectorError: string | null;
    runtime: RecordCodexTurnResult["runtime"];
  };
  exposure: MemoryExposureResult;
  workspaceAudit: WorkspaceAudit;
  runtimeAudit: RuntimeAudit;
  passedStructuralChecks: boolean;
}

function normalizeRepeatId(value: string): MemoryRepeatId {
  const normalized = value.trim().toUpperCase();

  if (normalized === "R1" || normalized === "R2" || normalized === "R3") {
    return normalized;
  }

  throw new Error(`Unknown repeat "${value}". Expected one of: R1, R2, R3.`);
}

function normalizedConditionId(value: string): MemoryConditionId {
  const normalized = value.trim().toUpperCase();

  if (normalized === "M1" || normalized === "M2" || normalized === "M3") {
    return normalized;
  }

  throw new Error(
    `Unknown memory condition "${value}". Expected one of: M1, M2, M3.`,
  );
}

async function sha256(path: string): Promise<string> {
  return createHash("sha256")
    .update(await readFile(path))
    .digest("hex");
}

const MEMORY_CONTENT_READ_PATTERN =
  /(?:^|[\s;&|"'(])(?:cat|sed|head|tail|less|more|awk|grep|rg)\b[^;\n|]*\bmemory\.md\b/i;

function eventReadsMemory(event: TraceEvent): boolean {
  if (
    event.kind !== "command.started" &&
    event.kind !== "command.completed"
  ) {
    return false;
  }

  const item = event.attributes.item;
  const command =
    typeof item === "object" &&
    item !== null &&
    "command" in item &&
    typeof item.command === "string"
      ? item.command
      : event.title;

  return MEMORY_CONTENT_READ_PATTERN.test(command);
}

export function detectMemoryExposure(
  events: TraceEvent[],
): MemoryExposureResult {
  const started = events.filter(
    (event) => event.kind === "command.started" && eventReadsMemory(event),
  );
  const completed = events.filter(
    (event) =>
      event.kind === "command.completed" && eventReadsMemory(event),
  );

  if (completed.length > 0) {
    return {
      status: "exposed",
      startedEventIds: started.map((event) => event.eventId),
      completedEventIds: completed.map((event) => event.eventId),
      firstCompletedSequence: completed[0]?.sequence,
      rule: "A completed observed content-reading command identified memory.md as its input.",
    };
  }

  if (started.length > 0) {
    return {
      status: "ambiguous",
      startedEventIds: started.map((event) => event.eventId),
      completedEventIds: [],
      rule: "A content-reading command targeting memory.md started, but no completed read was observed.",
    };
  }

  return {
    status: "not_exposed",
    startedEventIds: [],
    completedEventIds: [],
    rule: "No observed content-reading command start or completion targeted memory.md.",
  };
}

export async function auditPreparedWorkspace(
  prepared: PreparedMemoryCase,
): Promise<WorkspaceAudit> {
  const changedFiles: string[] = [];
  const unchangedFiles: string[] = [];
  const missingFiles: string[] = [];
  const finalChecksums: Record<string, string | null> = {};

  for (const [file, initialChecksum] of Object.entries(
    prepared.initialChecksums,
  )) {
    const path = resolve(prepared.workspaceDirectory, file);

    try {
      const finalChecksum = await sha256(path);
      finalChecksums[file] = finalChecksum;

      if (finalChecksum === initialChecksum) {
        unchangedFiles.push(file);
      } else {
        changedFiles.push(file);
      }
    } catch (error) {
      const code =
        typeof error === "object" && error !== null && "code" in error
          ? error.code
          : undefined;

      if (code !== "ENOENT") {
        throw error;
      }

      finalChecksums[file] = null;
      missingFiles.push(file);
      changedFiles.push(file);
    }
  }

  const proposalPath = resolve(prepared.workspaceDirectory, "proposal.md");
  let proposalNonBlank = false;

  try {
    proposalNonBlank = (await readFile(proposalPath, "utf8")).trim().length > 0;
  } catch {
    proposalNonBlank = false;
  }

  return {
    changedFiles,
    unchangedFiles,
    unexpectedChangedFiles: changedFiles.filter(
      (file) => file !== "proposal.md",
    ),
    missingFiles,
    proposalWritten: changedFiles.includes("proposal.md"),
    proposalNonBlank,
    finalChecksums,
  };
}

function relativeToRepository(
  repositoryRoot: string,
  absolutePath: string,
): string {
  const result = relative(repositoryRoot, resolve(absolutePath));
  return result === "" ? "." : result;
}

export async function runMemoryCase(
  options: RunMemoryCaseOptions,
  dependencies: RunMemoryCaseDependencies = {},
): Promise<MemoryCaseRunResult> {
  const repositoryRoot = resolve(options.repositoryRoot ?? process.cwd());
  const conditionId = normalizedConditionId(options.conditionId);
  const repeatId = normalizeRepeatId(options.repeatId);
  const runId = `${conditionId}-${repeatId}`;
  const now = options.now ?? new Date();
  const outputDirectory =
    options.outputDirectory ??
    resolve(
      repositoryRoot,
      ".trace-inspector",
      "case-studies",
      "memory-agent",
      "runs",
      runId,
    );
  const runLedger =
    options.runLedgerPath ??
    resolve(dirname(outputDirectory), "run-ledger.jsonl");
  const prepared = await prepareMemoryCaseWorkspace({
    conditionId,
    repositoryRoot,
    outputDirectory,
    preparedAt: now,
  });
  const prompt = await readFile(
    resolve(prepared.workspaceDirectory, "task.md"),
    "utf8",
  );
  const recordTurn = dependencies.recordTurn ?? recordCodexTurn;
  const replay = dependencies.replay ?? replayTrace;
  const trace = await recordTurn({
    prompt,
    cwd: prepared.workspaceDirectory,
    timeoutMs: options.timeoutMs,
    sandboxMode: "workspaceWrite",
    networkAccess: false,
    model: MEMORY_CASE_MODEL,
    reasoningEffort: MEMORY_CASE_REASONING_EFFORT,
  });
  const replayed = await replay(trace.traceId);
  const exposure = detectMemoryExposure(replayed.events);
  const workspaceAudit = await auditPreparedWorkspace(prepared);
  const runtimeAudit = auditMemoryCaseRuntime(
    trace.runtime,
    prepared.workspaceDirectory,
  );
  const passedStructuralChecks =
    trace.status === "completed" &&
    trace.collectorError === null &&
    exposure.status === "exposed" &&
    workspaceAudit.proposalWritten &&
    workspaceAudit.proposalNonBlank &&
    workspaceAudit.unexpectedChangedFiles.length === 0 &&
    workspaceAudit.missingFiles.length === 0 &&
    runtimeAudit.passed;
  const existingManifest = JSON.parse(
    await readFile(prepared.localRunManifest, "utf8"),
  ) as ExistingPreparedManifest;
  const completedManifest: CompletedRunManifest = {
    ...existingManifest,
    status: "run-recorded",
    runId,
    repeatId,
    endedAt: new Date().toISOString(),
    trace: {
      traceId: trace.traceId,
      status: trace.status,
      eventCount: trace.eventCount,
      traceDirectory: relativeToRepository(
        repositoryRoot,
        trace.traceDirectory,
      ),
      collectorError: trace.collectorError,
      runtime: trace.runtime,
    },
    exposure,
    workspaceAudit,
    runtimeAudit,
    passedStructuralChecks,
  };

  await writeFile(
    prepared.localRunManifest,
    `${JSON.stringify(completedManifest, null, 2)}\n`,
    "utf8",
  );
  await mkdir(dirname(runLedger), { recursive: true });
  await appendFile(
    runLedger,
    `${JSON.stringify({
      runId,
      conditionId,
      repeatId,
      traceId: trace.traceId,
      traceStatus: trace.status,
      collectorError: trace.collectorError,
      cliVersion: trace.runtime.cliVersion,
      model: trace.runtime.model,
      modelProvider: trace.runtime.modelProvider,
      serviceTier: trace.runtime.serviceTier,
      reasoningEffort: trace.runtime.reasoningEffort,
      approvalPolicy: trace.runtime.approvalPolicy,
      sandboxType: trace.runtime.sandbox?.type ?? null,
      networkAccess: trace.runtime.sandbox?.networkAccess ?? null,
      exposureStatus: exposure.status,
      changedFiles: workspaceAudit.changedFiles,
      unexpectedChangedFiles: workspaceAudit.unexpectedChangedFiles,
      proposalNonBlank: workspaceAudit.proposalNonBlank,
      runtimeAuditPassed: runtimeAudit.passed,
      passedStructuralChecks,
      runManifest: relativeToRepository(
        repositoryRoot,
        prepared.localRunManifest,
      ),
    })}\n`,
    "utf8",
  );

  return {
    runId,
    conditionId,
    repeatId,
    prepared,
    trace,
    exposure,
    workspaceAudit,
    runtimeAudit,
    passedStructuralChecks,
    runManifest: prepared.localRunManifest,
    runLedger,
  };
}
