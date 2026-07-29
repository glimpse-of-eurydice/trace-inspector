import { createHash } from "node:crypto";
import {
  access,
  copyFile,
  mkdir,
  readFile,
  writeFile,
} from "node:fs/promises";
import { basename, dirname, relative, resolve } from "node:path";
import {
  compareTraces,
  defaultComparisonPolicy,
} from "../analysis/compare-traces.js";
import type {
  AlignedEventPair,
  TraceDiff,
} from "../core/trace-comparison.js";
import type { TraceEvent } from "../core/trace-event.js";
import type { TraceManifest } from "../store/trace-files.js";
import { tracePaths } from "../store/trace-files.js";
import { replayTrace } from "../replay/replay-trace.js";
import type {
  MatrixRunSummary,
  MemoryMatrixManifest,
} from "./run-memory-matrix.js";

export type ManualReviewLabel = "present" | "absent" | "borderline" | "";

export interface TokenUsageSummary {
  totalTokens: number | null;
  inputTokens: number | null;
  cachedInputTokens: number | null;
  outputTokens: number | null;
  reasoningOutputTokens: number | null;
}

export interface FileTouch {
  file: string;
  sequence: number;
  eventId: string;
  operation: "command_reference" | "file_change";
}

export interface RetryCandidate {
  command: string;
  failedEventId: string;
  retryEventId: string;
  evidenceLevel: "inferred";
  rule: string;
}

export interface MemoryRunAnalysis {
  runId: string;
  conditionId: string;
  repeatId: string;
  traceId: string;
  traceStatus: string;
  exposureStatus: string;
  exposureSequence: number | null;
  runtime: MatrixRunSummary["runtime"];
  wallTimeMs: number | null;
  eventCount: number;
  commandCount: number;
  planEventCount: number;
  failureCount: number;
  retryCandidates: RetryCandidate[];
  orderedFileTouches: FileTouch[];
  proposalWritten: boolean;
  proposalWriteOperationCount: number;
  proposalRevisionStatus: "observed" | "not_observed" | "unknown";
  proposalSha256: string | null;
  proposalPath: string;
  tokenUsage: TokenUsageSummary;
  cost: null;
  costBoundary: string;
}

export interface ProjectedTrace {
  traceId: string;
  projectionId: "memory-operation-projection@0.1.0";
  events: TraceEvent[];
  sourceEventByProjectedId: Record<string, string>;
  claimBoundary: string;
}

export interface DivergenceEvidence {
  alignmentIndex: number;
  relation: string;
  reasons: string[];
  left: {
    projectedEventId: string | null;
    sourceEventId: string | null;
    rawFile: string | null;
    rawSequence: number | null;
  };
  right: {
    projectedEventId: string | null;
    sourceEventId: string | null;
    rawFile: string | null;
    rawSequence: number | null;
  };
}

export interface MemoryPairComparison {
  comparisonId: string;
  category: "cross_condition" | "within_condition";
  primaryDisplayPair: boolean;
  leftRunId: string;
  rightRunId: string;
  leftCondition: string;
  rightCondition: string;
  selectionRule: string;
  projection: ProjectedTrace["projectionId"];
  leftExposure: {
    status: string;
    sequence: number | null;
    eventIds: string[];
  };
  rightExposure: {
    status: string;
    sequence: number | null;
    eventIds: string[];
  };
  genericDiffFile: string;
  downstreamDiffFile: string | null;
  genericAlignmentStatus: TraceDiff["alignment"]["status"];
  genericFirstDivergence: DivergenceEvidence | null;
  downstreamStatus:
    | "divergence_observed"
    | "no_downstream_divergence_observed"
    | "ambiguous_alignment"
    | "intervention_not_exposed";
  downstreamAlignmentStatus: TraceDiff["alignment"]["status"] | null;
  firstDownstreamDivergence: DivergenceEvidence | null;
  claimBoundary: string;
}

export interface MemoryCaseAutomaticAnalysis {
  schemaVersion: "0.1";
  kind: "memory-case-automatic-analysis";
  generatedAt: string;
  matrixFile: string;
  matrixRepositoryCommit: string;
  runCount: number;
  projection: {
    id: ProjectedTrace["projectionId"];
    included: string[];
    excluded: string[];
    claimBoundary: string;
  };
  runs: MemoryRunAnalysis[];
  comparisons: MemoryPairComparison[];
  primaryComparisonIds: string[];
  outputDirectory: string;
  runTableCsv: string;
  comparisonIndex: string;
  summaryMarkdown: string;
  manualReviewTemplate: string;
  manualReviewReadme: string;
  blindedReviewDirectory: string;
  blindingMap: string;
}

interface LocalRunManifest {
  conditionId: string;
  repeatId: string;
  exposure: {
    status: string;
    firstCompletedSequence?: number;
    completedEventIds: string[];
  };
  workspaceAudit: {
    proposalWritten: boolean;
    finalChecksums: Record<string, string | null>;
  };
}

interface ManualReviewItem {
  blindedId: string;
  proposalFile: string;
  labels: Record<string, ManualReviewLabel>;
  evidence: Record<string, string>;
  confidence: "" | "low" | "medium" | "high";
  notes: string;
}

const KNOWN_WORKSPACE_FILES = [
  "memory.md",
  "calendar.json",
  "recent-energy-log.json",
  "commitments.md",
  "proposal.md",
];

const MANUAL_CRITERIA = [
  "temporary_state_presented_as_stable",
  "isolated_behavior_generalized_as_preference",
  "uncertainty_retained",
  "fixed_commitment_retained",
  "unsupported_personalization",
  "recorded_evidence_distinguished_from_assumption",
  "minimum_sixty_minutes_monday_preparation",
  "both_required_toby_outings_retained",
] as const;

function asObject(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function readString(
  object: Record<string, unknown> | undefined,
  key: string,
): string | undefined {
  const value = object?.[key];
  return typeof value === "string" ? value : undefined;
}

function readNumber(
  object: Record<string, unknown> | undefined,
  key: string,
): number | null {
  const value = object?.[key];
  return typeof value === "number" ? value : null;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableJson(entry)).join(",")}]`;
  }

  const object = asObject(value);

  if (object !== undefined) {
    return `{${Object.entries(object)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function projectedEvent(
  source: TraceEvent,
  suffix: string,
  kind: TraceEvent["kind"],
  title: string,
  attributes: Record<string, unknown>,
  offset: number,
): TraceEvent {
  return {
    ...source,
    eventId: `${source.eventId}:projection:${suffix}`,
    sequence: source.sequence * 10 + offset,
    kind,
    title,
    attributes: {
      ...attributes,
      projection: {
        id: "memory-operation-projection@0.1.0",
        sourceEventId: source.eventId,
        sourceSequence: source.sequence,
      },
    },
  };
}

function itemFor(event: TraceEvent): Record<string, unknown> | undefined {
  return asObject(event.attributes.item);
}

export function projectMemoryTrace(events: TraceEvent[]): ProjectedTrace {
  const projected: TraceEvent[] = [];
  const sourceEventByProjectedId: Record<string, string> = {};

  for (const event of [...events].sort(
    (left, right) => left.sequence - right.sequence,
  )) {
    if (
      event.kind === "turn.started" ||
      event.kind === "turn.completed" ||
      event.kind === "command.started" ||
      event.kind === "plan.updated"
    ) {
      const projectedId = `${event.eventId}:projection:event`;
      const copy = projectedEvent(
        event,
        "event",
        event.kind,
        event.title,
        event.attributes,
        0,
      );
      projected.push(copy);
      sourceEventByProjectedId[projectedId] = event.eventId;
      continue;
    }

    if (event.kind === "command.completed") {
      const completion = projectedEvent(
        event,
        "completion",
        event.kind,
        event.title,
        event.attributes,
        0,
      );
      projected.push(completion);
      sourceEventByProjectedId[completion.eventId] = event.eventId;

      const output = readString(itemFor(event), "aggregatedOutput");

      if (output !== undefined) {
        const outputEvent = projectedEvent(
          event,
          "aggregated-output",
          "command.output",
          "Projected complete command output",
          { delta: output },
          1,
        );
        projected.push(outputEvent);
        sourceEventByProjectedId[outputEvent.eventId] = event.eventId;
      }
      continue;
    }

    if (event.kind === "message.completed") {
      const item = itemFor(event);

      if (readString(item, "type") === "agentMessage") {
        const text = readString(item, "text") ?? "";
        const outputEvent = projectedEvent(
          event,
          "complete-message",
          "message.output",
          "Projected complete agent message",
          { delta: text, phase: readString(item, "phase") },
          0,
        );
        projected.push(outputEvent);
        sourceEventByProjectedId[outputEvent.eventId] = event.eventId;
      }
      continue;
    }

    const item = itemFor(event);

    if (
      event.sourceEventType === "item/completed" &&
      readString(item, "type") === "fileChange"
    ) {
      const outputEvent = projectedEvent(
        event,
        "file-change",
        "command.output",
        "Projected file-change evidence",
        { delta: stableJson(item?.changes) },
        0,
      );
      projected.push(outputEvent);
      sourceEventByProjectedId[outputEvent.eventId] = event.eventId;
    }
  }

  return {
    traceId: events[0]?.traceId ?? "empty-trace",
    projectionId: "memory-operation-projection@0.1.0",
    events: projected,
    sourceEventByProjectedId,
    claimBoundary:
      "This deterministic projection aggregates streamed output into complete operation evidence. It is an analyzer representation, not an additional runtime observation.",
  };
}

function sourceSequence(event: TraceEvent): number {
  const projection = asObject(event.attributes.projection);
  return readNumber(projection, "sourceSequence") ?? event.sequence;
}

export function projectedEventsAfterExposure(
  projection: ProjectedTrace,
  exposureSequence: number,
): TraceEvent[] {
  return projection.events.filter(
    (event) => sourceSequence(event) > exposureSequence,
  );
}

function compactCommand(command: string): string {
  return command.trim().replaceAll(/\s+/g, " ");
}

function commandFor(event: TraceEvent): string | undefined {
  return readString(itemFor(event), "command");
}

function fileTouches(events: TraceEvent[]): FileTouch[] {
  const touches: FileTouch[] = [];

  for (const event of events) {
    const command = commandFor(event);

    if (event.kind === "command.completed" && command !== undefined) {
      const ordered = KNOWN_WORKSPACE_FILES.flatMap((file) => {
        const index = command.indexOf(file);
        return index === -1 ? [] : [{ file, index }];
      }).sort((left, right) => left.index - right.index);

      for (const { file } of ordered) {
        touches.push({
          file,
          sequence: event.sequence,
          eventId: event.eventId,
          operation: "command_reference",
        });
      }
    }

    const item = itemFor(event);

    if (
      event.sourceEventType === "item/completed" &&
      readString(item, "type") === "fileChange"
    ) {
      const changes = Array.isArray(item?.changes) ? item.changes : [];

      for (const change of changes) {
        const path = readString(asObject(change), "path");

        if (path === undefined) {
          continue;
        }

        const file = KNOWN_WORKSPACE_FILES.find((candidate) =>
          path.endsWith(candidate),
        );

        if (file !== undefined) {
          touches.push({
            file,
            sequence: event.sequence,
            eventId: event.eventId,
            operation: "file_change",
          });
        }
      }
    }
  }

  return touches;
}

function exactRetryCandidates(events: TraceEvent[]): RetryCandidate[] {
  const sorted = [...events].sort(
    (left, right) => left.sequence - right.sequence,
  );
  const failedByCommand = new Map<
    string,
    { eventId: string; sequence: number }
  >();
  const candidates: RetryCandidate[] = [];

  for (const event of sorted) {
    const command = commandFor(event);

    if (command === undefined) {
      continue;
    }

    const normalized = compactCommand(command);

    if (event.kind === "command.completed" && event.status === "failed") {
      failedByCommand.set(normalized, {
        eventId: event.eventId,
        sequence: event.sequence,
      });
      continue;
    }

    if (event.kind === "command.started") {
      const failed = failedByCommand.get(normalized);

      if (failed !== undefined && failed.sequence < event.sequence) {
        candidates.push({
          command: normalized,
          failedEventId: failed.eventId,
          retryEventId: event.eventId,
          evidenceLevel: "inferred",
          rule: "The exact normalized command started again after an observed failed completion.",
        });
        failedByCommand.delete(normalized);
      }
    }
  }

  return candidates;
}

function finalTokenUsage(events: TraceEvent[]): TokenUsageSummary {
  const latest = [...events]
    .filter((event) => event.kind === "token_usage.updated")
    .sort((left, right) => right.sequence - left.sequence)[0];
  const tokenUsage = asObject(latest?.attributes.tokenUsage);
  const total = asObject(tokenUsage?.total);

  return {
    totalTokens: readNumber(total, "totalTokens"),
    inputTokens: readNumber(total, "inputTokens"),
    cachedInputTokens: readNumber(total, "cachedInputTokens"),
    outputTokens: readNumber(total, "outputTokens"),
    reasoningOutputTokens: readNumber(total, "reasoningOutputTokens"),
  };
}

function proposalFileChangeCount(events: TraceEvent[]): number {
  return events.filter((event) => {
    const item = itemFor(event);

    if (
      event.sourceEventType !== "item/completed" ||
      readString(item, "type") !== "fileChange"
    ) {
      return false;
    }

    const changes = Array.isArray(item?.changes) ? item.changes : [];
    return changes.some((change) =>
      (readString(asObject(change), "path") ?? "").endsWith("proposal.md"),
    );
  }).length;
}

function elapsedMs(manifest: TraceManifest): number | null {
  const start = new Date(manifest.startedAt).getTime();
  const end = new Date(manifest.endedAt).getTime();
  return Number.isFinite(start) && Number.isFinite(end) && end >= start
    ? end - start
    : null;
}

function relativePath(repositoryRoot: string, path: string): string {
  return relative(repositoryRoot, resolve(path));
}

async function analyzeRun(
  repositoryRoot: string,
  run: MatrixRunSummary,
): Promise<{
  analysis: MemoryRunAnalysis;
  events: TraceEvent[];
  localManifest: LocalRunManifest;
}> {
  if (run.traceId === null || run.runManifest === null) {
    throw new Error(`Run ${run.runId} has no trace or run manifest.`);
  }

  const replay = await replayTrace(run.traceId);
  const localManifest = JSON.parse(
    await readFile(run.runManifest, "utf8"),
  ) as LocalRunManifest;
  const traceManifest = JSON.parse(
    await readFile(tracePaths(run.traceId).manifest, "utf8"),
  ) as TraceManifest;
  const proposalPath = resolve(
    repositoryRoot,
    ".trace-inspector",
    "case-studies",
    "memory-agent",
    "runs",
    run.runId,
    "workspace",
    "proposal.md",
  );
  const proposalWrites = proposalFileChangeCount(replay.events);
  const commandEvents = replay.events.filter(
    (event) => event.kind === "command.started",
  );
  const failures = replay.spans.filter(
    (span) => span.status === "failed",
  );
  const analysis: MemoryRunAnalysis = {
    runId: run.runId,
    conditionId: localManifest.conditionId,
    repeatId: localManifest.repeatId,
    traceId: run.traceId,
    traceStatus: run.traceStatus ?? "unknown",
    exposureStatus: localManifest.exposure.status,
    exposureSequence:
      localManifest.exposure.firstCompletedSequence ?? null,
    runtime: run.runtime,
    wallTimeMs: elapsedMs(traceManifest),
    eventCount: replay.events.length,
    commandCount: commandEvents.length,
    planEventCount: replay.events.filter(
      (event) => event.kind === "plan.updated",
    ).length,
    failureCount: failures.length,
    retryCandidates: exactRetryCandidates(replay.events),
    orderedFileTouches: fileTouches(replay.events),
    proposalWritten: localManifest.workspaceAudit.proposalWritten,
    proposalWriteOperationCount: proposalWrites,
    proposalRevisionStatus:
      proposalWrites > 1
        ? "observed"
        : proposalWrites === 1
          ? "not_observed"
          : "unknown",
    proposalSha256:
      localManifest.workspaceAudit.finalChecksums["proposal.md"] ?? null,
    proposalPath: relativePath(repositoryRoot, proposalPath),
    tokenUsage: finalTokenUsage(replay.events),
    cost: null,
    costBoundary:
      "No monetary cost field was exposed by the recorded runtime events.",
  };

  return { analysis, events: replay.events, localManifest };
}

function divergenceEvidence(
  pair: AlignedEventPair | undefined,
  leftProjection: ProjectedTrace,
  rightProjection: ProjectedTrace,
): DivergenceEvidence | null {
  if (pair === undefined || pair.relation === "same") {
    return null;
  }

  const leftEvent = leftProjection.events.find(
    (event) => event.eventId === pair.leftEventId,
  );
  const rightEvent = rightProjection.events.find(
    (event) => event.eventId === pair.rightEventId,
  );

  return {
    alignmentIndex: pair.alignmentIndex,
    relation: pair.relation,
    reasons: pair.reasons.map((reason) => reason.description),
    left: {
      projectedEventId: pair.leftEventId ?? null,
      sourceEventId:
        pair.leftEventId === undefined
          ? null
          : (leftProjection.sourceEventByProjectedId[pair.leftEventId] ??
            null),
      rawFile: leftEvent?.rawRef.file ?? null,
      rawSequence: leftEvent?.rawRef.sequence ?? null,
    },
    right: {
      projectedEventId: pair.rightEventId ?? null,
      sourceEventId:
        pair.rightEventId === undefined
          ? null
          : (rightProjection.sourceEventByProjectedId[pair.rightEventId] ??
            null),
      rawFile: rightEvent?.rawRef.file ?? null,
      rawSequence: rightEvent?.rawRef.sequence ?? null,
    },
  };
}

function firstChangedPair(diff: TraceDiff): AlignedEventPair | undefined {
  if (diff.alignment.status === "ambiguous") {
    return undefined;
  }

  return diff.alignedPairs.find((pair) => pair.relation !== "same");
}

function workspaceFor(repositoryRoot: string, runId: string): string {
  return resolve(
    repositoryRoot,
    ".trace-inspector",
    "case-studies",
    "memory-agent",
    "runs",
    runId,
    "workspace",
  );
}

async function compareRunPair(
  repositoryRoot: string,
  outputDirectory: string,
  left: {
    run: MemoryRunAnalysis;
    events: TraceEvent[];
    localManifest: LocalRunManifest;
  },
  right: {
    run: MemoryRunAnalysis;
    events: TraceEvent[];
    localManifest: LocalRunManifest;
  },
  options: {
    category: MemoryPairComparison["category"];
    primaryDisplayPair: boolean;
    selectionRule: string;
  },
): Promise<MemoryPairComparison> {
  const comparisonId = `${right.run.runId}-vs-${left.run.runId}`;
  const comparisonDirectory = resolve(
    outputDirectory,
    "comparisons",
    comparisonId,
  );
  const leftProjection = projectMemoryTrace(left.events);
  const rightProjection = projectMemoryTrace(right.events);
  const policy = defaultComparisonPolicy({
    leftWorkspaceRoot: workspaceFor(repositoryRoot, left.run.runId),
    rightWorkspaceRoot: workspaceFor(repositoryRoot, right.run.runId),
  });
  const genericDiff = compareTraces(
    leftProjection.events,
    rightProjection.events,
    policy,
  );
  const genericDiffFile = resolve(comparisonDirectory, "generic-diff.json");
  const leftExposureSequence = left.run.exposureSequence;
  const rightExposureSequence = right.run.exposureSequence;
  let downstreamDiff: TraceDiff | null = null;
  let downstreamStatus: MemoryPairComparison["downstreamStatus"];

  if (
    left.run.exposureStatus !== "exposed" ||
    right.run.exposureStatus !== "exposed" ||
    leftExposureSequence === null ||
    rightExposureSequence === null
  ) {
    downstreamStatus = "intervention_not_exposed";
  } else {
    downstreamDiff = compareTraces(
      projectedEventsAfterExposure(
        leftProjection,
        leftExposureSequence,
      ),
      projectedEventsAfterExposure(
        rightProjection,
        rightExposureSequence,
      ),
      policy,
    );
    downstreamStatus =
      downstreamDiff.alignment.status === "ambiguous"
        ? "ambiguous_alignment"
        : downstreamDiff.firstObservableDivergence === undefined
          ? "no_downstream_divergence_observed"
          : "divergence_observed";
  }

  await mkdir(comparisonDirectory, { recursive: true });
  await writeFile(
    genericDiffFile,
    `${JSON.stringify(genericDiff, null, 2)}\n`,
  );
  const downstreamDiffFile =
    downstreamDiff === null
      ? null
      : resolve(comparisonDirectory, "downstream-diff.json");

  if (downstreamDiff !== null && downstreamDiffFile !== null) {
    await writeFile(
      downstreamDiffFile,
      `${JSON.stringify(downstreamDiff, null, 2)}\n`,
    );
  }

  const genericPair = firstChangedPair(genericDiff);
  const downstreamPair =
    downstreamDiff === null ? undefined : firstChangedPair(downstreamDiff);
  const report: MemoryPairComparison = {
    comparisonId,
    category: options.category,
    primaryDisplayPair: options.primaryDisplayPair,
    leftRunId: left.run.runId,
    rightRunId: right.run.runId,
    leftCondition: left.run.conditionId,
    rightCondition: right.run.conditionId,
    selectionRule: options.selectionRule,
    projection: leftProjection.projectionId,
    leftExposure: {
      status: left.run.exposureStatus,
      sequence: left.run.exposureSequence,
      eventIds: left.localManifest.exposure.completedEventIds,
    },
    rightExposure: {
      status: right.run.exposureStatus,
      sequence: right.run.exposureSequence,
      eventIds: right.localManifest.exposure.completedEventIds,
    },
    genericDiffFile: relativePath(repositoryRoot, genericDiffFile),
    downstreamDiffFile:
      downstreamDiffFile === null
        ? null
        : relativePath(repositoryRoot, downstreamDiffFile),
    genericAlignmentStatus: genericDiff.alignment.status,
    genericFirstDivergence: divergenceEvidence(
      genericPair,
      leftProjection,
      rightProjection,
    ),
    downstreamStatus,
    downstreamAlignmentStatus: downstreamDiff?.alignment.status ?? null,
    firstDownstreamDivergence: divergenceEvidence(
      downstreamPair,
      leftProjection,
      rightProjection,
    ),
    claimBoundary:
      "Alignment and divergence are inferred under memory-operation-projection@0.1.0 and v2-default@0.2.0. A first downstream difference is not proof that memory representation caused later behavior.",
  };
  await writeFile(
    resolve(comparisonDirectory, "comparison.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  return report;
}

function csvCell(value: unknown): string {
  const text =
    value === null || value === undefined
      ? ""
      : Array.isArray(value)
        ? value.join(" > ")
        : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function runTableCsv(runs: MemoryRunAnalysis[]): string {
  const headers = [
    "run_id",
    "condition",
    "repeat",
    "trace_id",
    "trace_status",
    "exposure_status",
    "exposure_sequence",
    "wall_time_ms",
    "event_count",
    "command_count",
    "plan_event_count",
    "failure_count",
    "exact_retry_candidate_count",
    "proposal_write_operation_count",
    "proposal_revision_status",
    "total_tokens",
    "input_tokens",
    "cached_input_tokens",
    "output_tokens",
    "reasoning_output_tokens",
    "proposal_sha256",
    "ordered_file_touches",
  ];
  const rows = runs.map((run) => [
    run.runId,
    run.conditionId,
    run.repeatId,
    run.traceId,
    run.traceStatus,
    run.exposureStatus,
    run.exposureSequence,
    run.wallTimeMs,
    run.eventCount,
    run.commandCount,
    run.planEventCount,
    run.failureCount,
    run.retryCandidates.length,
    run.proposalWriteOperationCount,
    run.proposalRevisionStatus,
    run.tokenUsage.totalTokens,
    run.tokenUsage.inputTokens,
    run.tokenUsage.cachedInputTokens,
    run.tokenUsage.outputTokens,
    run.tokenUsage.reasoningOutputTokens,
    run.proposalSha256,
    run.orderedFileTouches.map(
      (touch) => `${touch.sequence}:${touch.file}:${touch.operation}`,
    ),
  ]);
  return [headers, ...rows]
    .map((row) => row.map(csvCell).join(","))
    .join("\n")
    .concat("\n");
}

function summaryMarkdown(
  runs: MemoryRunAnalysis[],
  comparisons: MemoryPairComparison[],
): string {
  const lines = [
    "# Memory-conditioned agent: automatic analysis",
    "",
    "> This report describes one nine-run case study. It does not estimate a population effect or establish that a memory representation caused an observed difference.",
    "",
    "## Run table",
    "",
    "| Run | Status | Exposure | Commands | Plans | Failures | Proposal writes | Tokens |",
    "|---|---|---|---:|---:|---:|---:|---:|",
    ...runs.map(
      (run) =>
        `| ${run.runId} | ${run.traceStatus} | ${run.exposureStatus} @ ${run.exposureSequence ?? "n/a"} | ${run.commandCount} | ${run.planEventCount} | ${run.failureCount} | ${run.proposalWriteOperationCount} | ${run.tokenUsage.totalTokens ?? "n/a"} |`,
    ),
    "",
    "## Comparisons",
    "",
    "| Comparison | Category | Generic alignment | Downstream result | First downstream alignment |",
    "|---|---|---|---|---:|",
    ...comparisons.map(
      (comparison) =>
        `| ${comparison.comparisonId}${comparison.primaryDisplayPair ? " ★" : ""} | ${comparison.category} | ${comparison.genericAlignmentStatus} | ${comparison.downstreamStatus} | ${comparison.firstDownstreamDivergence?.alignmentIndex ?? "n/a"} |`,
    ),
    "",
    "★ Primary display pair selected by the predeclared first-complete-run rule.",
    "",
    "## Evidence boundary",
    "",
    "- Runtime events and generated artifacts are observed.",
    "- The operation projection, event alignment, retry candidates, and divergence positions are inferred.",
    "- The report does not expose hidden reasoning and does not make causal claims.",
    "",
  ];
  return lines.join("\n");
}

function blindedOrder(
  repositoryCommit: string,
  runs: MemoryRunAnalysis[],
): MemoryRunAnalysis[] {
  return [...runs].sort((left, right) => {
    const leftHash = createHash("sha256")
      .update(`${repositoryCommit}:${left.runId}`)
      .digest("hex");
    const rightHash = createHash("sha256")
      .update(`${repositoryCommit}:${right.runId}`)
      .digest("hex");
    return leftHash.localeCompare(rightHash);
  });
}

async function writeReviewTemplateIfMissing(
  path: string,
  content: string,
): Promise<void> {
  try {
    await access(path);
  } catch {
    await writeFile(path, content);
  }
}

async function prepareManualReview(
  repositoryRoot: string,
  outputDirectory: string,
  repositoryCommit: string,
  runs: MemoryRunAnalysis[],
): Promise<{
  template: string;
  readme: string;
  blindedDirectory: string;
  blindingMap: string;
}> {
  const reviewRoot = resolve(outputDirectory, "manual-review");
  const blindedDirectory = resolve(reviewRoot, "blinded");
  const template = resolve(reviewRoot, "annotations.json");
  const templateCsv = resolve(reviewRoot, "annotations.csv");
  const readme = resolve(reviewRoot, "README.md");
  const blindingMap = resolve(reviewRoot, "BLINDING_MAP_DO_NOT_OPEN.json");
  const ordered = blindedOrder(repositoryCommit, runs);
  await mkdir(blindedDirectory, { recursive: true });
  const items: ManualReviewItem[] = [];
  const map: Array<{
    blindedId: string;
    runId: string;
    conditionId: string;
    repeatId: string;
    traceId: string;
  }> = [];

  for (const [index, run] of ordered.entries()) {
    const blindedId = `B${String(index + 1).padStart(2, "0")}`;
    const blindedFile = resolve(blindedDirectory, `${blindedId}.md`);
    await copyFile(resolve(repositoryRoot, run.proposalPath), blindedFile);
    items.push({
      blindedId,
      proposalFile: relativePath(repositoryRoot, blindedFile),
      labels: Object.fromEntries(
        MANUAL_CRITERIA.map((criterion) => [criterion, ""]),
      ),
      evidence: Object.fromEntries(
        MANUAL_CRITERIA.map((criterion) => [criterion, ""]),
      ),
      confidence: "",
      notes: "",
    });
    map.push({
      blindedId,
      runId: run.runId,
      conditionId: run.conditionId,
      repeatId: run.repeatId,
      traceId: run.traceId,
    });
  }

  await writeReviewTemplateIfMissing(
    template,
    `${JSON.stringify(
      {
        schemaVersion: "0.1",
        status: "unreviewed",
        allowedLabels: ["present", "absent", "borderline"],
        criteria: MANUAL_CRITERIA,
        items,
      },
      null,
      2,
    )}\n`,
  );
  const csvHeaders = [
    "blinded_id",
    ...MANUAL_CRITERIA,
    ...MANUAL_CRITERIA.map((criterion) => `${criterion}_evidence`),
    "confidence",
    "notes",
  ];
  await writeReviewTemplateIfMissing(
    templateCsv,
    `${csvHeaders.map(csvCell).join(",")}\n${items
      .map((item) =>
        [
          item.blindedId,
          ...MANUAL_CRITERIA.map(() => ""),
          ...MANUAL_CRITERIA.map(() => ""),
          "",
          "",
        ]
          .map(csvCell)
          .join(","),
      )
      .join("\n")}\n`,
  );
  await writeFile(
    blindingMap,
    `${JSON.stringify(
      {
        warning:
          "Do not open until all blinded annotations are locked.",
        deterministicBlindingSeed: `sha256(${repositoryCommit}:runId)`,
        map,
      },
      null,
      2,
    )}\n`,
  );
  await writeFile(
    readme,
    [
      "# Blinded manual-review bundle",
      "",
      "Read `docs/MEMORY_AGENT_MANUAL_REVIEW_GUIDE.md` before annotating.",
      "",
      "1. Keep `BLINDING_MAP_DO_NOT_OPEN.json` closed.",
      "2. Review `blinded/B01.md` through `blinded/B09.md` in ID order.",
      "3. Enter `present`, `absent`, or `borderline` in `annotations.csv` or `annotations.json`.",
      "4. Cite proposal line numbers or a short exact phrase in every evidence field.",
      "5. Lock a copy of the completed annotation file before opening the blinding map.",
      "",
      "Existing annotation templates are preserved when analysis is rerun.",
      "",
      "Trace alignment ambiguity must not be manually resolved during artifact review.",
      "",
    ].join("\n"),
  );

  return {
    template,
    readme,
    blindedDirectory,
    blindingMap,
  };
}

function eligibleRun(
  matrix: MemoryMatrixManifest,
  conditionId: string,
): MatrixRunSummary {
  const run = matrix.runs.find(
    (candidate) =>
      candidate.runId.startsWith(`${conditionId}-`) &&
      candidate.traceStatus === "completed" &&
      candidate.collectorError === null &&
      candidate.exposureStatus === "exposed" &&
      candidate.passedStructuralChecks === true,
  );

  if (run === undefined) {
    throw new Error(
      `No complete, exposed, structurally valid run for ${conditionId}.`,
    );
  }

  return run;
}

export async function analyzeMemoryCase(
  repositoryRootInput = process.cwd(),
): Promise<MemoryCaseAutomaticAnalysis> {
  const repositoryRoot = resolve(repositoryRootInput);
  const caseRoot = resolve(
    repositoryRoot,
    ".trace-inspector",
    "case-studies",
    "memory-agent",
  );
  const matrixFile = resolve(caseRoot, "matrix-manifest.json");
  const outputDirectory = resolve(caseRoot, "analysis");
  const matrix = JSON.parse(
    await readFile(matrixFile, "utf8"),
  ) as MemoryMatrixManifest;

  if (
    matrix.status !== "completed" ||
    !matrix.allRunsAttempted ||
    !matrix.allStructuralChecksPassed ||
    matrix.runs.length !== 9
  ) {
    throw new Error(
      "Automatic analysis requires a completed nine-run matrix with all structural checks passed.",
    );
  }

  await mkdir(outputDirectory, { recursive: true });
  const analyzed = await Promise.all(
    matrix.runs.map((run) => analyzeRun(repositoryRoot, run)),
  );
  const byRunId = new Map(
    analyzed.map((item) => [item.analysis.runId, item]),
  );
  const comparisons: MemoryPairComparison[] = [];
  const primaryM1 = eligibleRun(matrix, "M1");
  const primaryM2 = eligibleRun(matrix, "M2");
  const primaryM3 = eligibleRun(matrix, "M3");
  const primaryPairs: Array<[MatrixRunSummary, MatrixRunSummary]> = [
    [primaryM1, primaryM2],
    [primaryM2, primaryM3],
  ];

  for (const [leftRun, rightRun] of primaryPairs) {
    const left = byRunId.get(leftRun.runId);
    const right = byRunId.get(rightRun.runId);

    if (left === undefined || right === undefined) {
      throw new Error("Primary comparison run was not analyzed.");
    }

    comparisons.push(
      await compareRunPair(
        repositoryRoot,
        outputDirectory,
        {
          run: left.analysis,
          events: left.events,
          localManifest: left.localManifest,
        },
        {
          run: right.analysis,
          events: right.events,
          localManifest: right.localManifest,
        },
        {
          category: "cross_condition",
          primaryDisplayPair: true,
          selectionRule:
            "First complete, non-error, exposed, structurally valid run from each condition in the predeclared matrix order.",
        },
      ),
    );
  }

  for (const repeatId of ["R1", "R2", "R3"]) {
    for (const [leftCondition, rightCondition] of [
      ["M1", "M2"],
      ["M2", "M3"],
    ]) {
      const left = byRunId.get(`${leftCondition}-${repeatId}`);
      const right = byRunId.get(`${rightCondition}-${repeatId}`);

      if (
        left === undefined ||
        right === undefined ||
        comparisons.some(
          (comparison) =>
            comparison.leftRunId === left.analysis.runId &&
            comparison.rightRunId === right.analysis.runId,
        )
      ) {
        continue;
      }

      comparisons.push(
        await compareRunPair(
          repositoryRoot,
          outputDirectory,
          {
            run: left.analysis,
            events: left.events,
            localManifest: left.localManifest,
          },
          {
            run: right.analysis,
            events: right.events,
            localManifest: right.localManifest,
          },
          {
            category: "cross_condition",
            primaryDisplayPair: false,
            selectionRule:
              "Matched-repeat descriptive comparison declared after collection; not selected for effect strength.",
          },
        ),
      );
    }
  }

  for (const conditionId of ["M1", "M2", "M3"]) {
    const baseline = byRunId.get(`${conditionId}-R1`);

    if (baseline === undefined) {
      continue;
    }

    for (const repeatId of ["R2", "R3"]) {
      const variant = byRunId.get(`${conditionId}-${repeatId}`);

      if (variant === undefined) {
        continue;
      }

      comparisons.push(
        await compareRunPair(
          repositoryRoot,
          outputDirectory,
          {
            run: baseline.analysis,
            events: baseline.events,
            localManifest: baseline.localManifest,
          },
          {
            run: variant.analysis,
            events: variant.events,
            localManifest: variant.localManifest,
          },
          {
            category: "within_condition",
            primaryDisplayPair: false,
            selectionRule:
              "R2 or R3 compared with R1 within the same condition to inspect run-level instability.",
          },
        ),
      );
    }
  }

  const runTable = resolve(outputDirectory, "run-table.csv");
  const comparisonIndex = resolve(
    outputDirectory,
    "comparison-index.json",
  );
  const summaryFile = resolve(outputDirectory, "analysis-summary.md");
  await writeFile(
    runTable,
    runTableCsv(analyzed.map((item) => item.analysis)),
  );
  await writeFile(
    comparisonIndex,
    `${JSON.stringify(comparisons, null, 2)}\n`,
  );
  await writeFile(
    summaryFile,
    summaryMarkdown(
      analyzed.map((item) => item.analysis),
      comparisons,
    ),
  );
  const manual = await prepareManualReview(
    repositoryRoot,
    outputDirectory,
    matrix.repositoryCommit,
    analyzed.map((item) => item.analysis),
  );
  const analysis: MemoryCaseAutomaticAnalysis = {
    schemaVersion: "0.1",
    kind: "memory-case-automatic-analysis",
    generatedAt: new Date().toISOString(),
    matrixFile: relativePath(repositoryRoot, matrixFile),
    matrixRepositoryCommit: matrix.repositoryCommit,
    runCount: analyzed.length,
    projection: {
      id: "memory-operation-projection@0.1.0",
      included: [
        "turn lifecycle",
        "command lifecycle",
        "complete command output",
        "complete agent messages",
        "plan updates",
        "file-change evidence",
      ],
      excluded: [
        "streaming token deltas",
        "token-usage notifications",
        "RPC setup",
        "MCP startup notifications",
        "rate-limit notifications",
      ],
      claimBoundary:
        "Projection is deterministic and links to source event/raw references. It reduces transport noise but is not hidden model state.",
    },
    runs: analyzed.map((item) => item.analysis),
    comparisons,
    primaryComparisonIds: comparisons
      .filter((comparison) => comparison.primaryDisplayPair)
      .map((comparison) => comparison.comparisonId),
    outputDirectory: relativePath(repositoryRoot, outputDirectory),
    runTableCsv: relativePath(repositoryRoot, runTable),
    comparisonIndex: relativePath(repositoryRoot, comparisonIndex),
    summaryMarkdown: relativePath(repositoryRoot, summaryFile),
    manualReviewTemplate: relativePath(repositoryRoot, manual.template),
    manualReviewReadme: relativePath(repositoryRoot, manual.readme),
    blindedReviewDirectory: relativePath(
      repositoryRoot,
      manual.blindedDirectory,
    ),
    blindingMap: relativePath(repositoryRoot, manual.blindingMap),
  };
  await writeFile(
    resolve(outputDirectory, "analysis.json"),
    `${JSON.stringify(analysis, null, 2)}\n`,
  );
  return analysis;
}
