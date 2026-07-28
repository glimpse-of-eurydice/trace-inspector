import { readFile } from "node:fs/promises";
import { compareTraces } from "../analysis/compare-traces.js";
import type {
  AlignmentRelation,
  DifferenceReason,
} from "../core/trace-comparison.js";
import type {
  EvidenceLevel,
  TraceEvent,
  TraceEventKind,
  TraceEventStatus,
} from "../core/trace-event.js";

export const COMPARISON_GOLDEN_SET_FILE =
  "fixtures/comparisons/golden-set/cases.json";

interface GoldenEventSpec {
  kind: TraceEventKind;
  status?: TraceEventStatus;
  command?: string;
  output?: string;
  plan?: unknown;
  sourceEventType?: string;
  eventId?: string;
  entityId?: string;
  occurredAt?: string;
  rawFile?: string;
  rawSequence?: number;
}

interface ExpectedDivergence {
  alignmentIndex: number;
  relation: Exclude<AlignmentRelation, "same">;
  leftSequence: number | null;
  rightSequence: number | null;
  reasonCodes: DifferenceReason["code"][];
}

interface GoldenCase {
  caseId: string;
  description: string;
  leftEvents: GoldenEventSpec[];
  rightEvents: GoldenEventSpec[];
  expected: {
    alignmentStatus: "resolved" | "ambiguous";
    firstDivergence: ExpectedDivergence | null;
    summary: {
      same: number;
      changed: number;
      inserted: number;
      deleted: number;
    };
  };
}

interface GoldenSet {
  schemaVersion: "0.1";
  description: string;
  cases: GoldenCase[];
}

export interface GoldenCaseResult {
  caseId: string;
  description: string;
  passed: boolean;
  failures: string[];
  actual: {
    alignmentStatus: "resolved" | "ambiguous";
    optimalPathCount: 1 | "multiple";
    firstDivergence:
      | {
          alignmentIndex: number;
          relation: Exclude<AlignmentRelation, "same">;
          leftSequence: number | null;
          rightSequence: number | null;
          reasonCodes: DifferenceReason["code"][];
        }
      | null;
  };
}

export interface GoldenSetReport {
  fixtureFile: string;
  total: number;
  passed: number;
  failed: number;
  results: GoldenCaseResult[];
}

function evidenceLevelFor(kind: TraceEventKind): EvidenceLevel {
  return kind === "message.output" ? "model_reported" : "observed";
}

function sourceEventTypeFor(spec: GoldenEventSpec): string {
  if (spec.sourceEventType !== undefined) {
    return spec.sourceEventType;
  }

  return spec.kind.replaceAll(".", "/");
}

function titleFor(spec: GoldenEventSpec): string {
  if (spec.command !== undefined) {
    return `${spec.kind}: ${spec.command}`;
  }

  if (spec.output !== undefined) {
    return `${spec.kind}: ${spec.output}`;
  }

  return spec.kind;
}

function attributesFor(spec: GoldenEventSpec): Record<string, unknown> {
  const attributes: Record<string, unknown> = {};

  if (spec.command !== undefined) {
    attributes.item = {
      type: "commandExecution",
      command: spec.command,
    };
  }

  if (spec.output !== undefined) {
    attributes.delta = spec.output;
  }

  if (spec.plan !== undefined) {
    attributes.plan = spec.plan;
  }

  return attributes;
}

function eventsFor(
  caseId: string,
  side: "left" | "right",
  specs: GoldenEventSpec[],
): TraceEvent[] {
  const traceId = `golden:${caseId}:${side}`;

  return specs.map((spec, index): TraceEvent => {
    const sequence = index + 1;

    return {
      schemaVersion: "0.1",
      eventId: spec.eventId ?? `${traceId}:${sequence}`,
      traceId,
      sequence,
      source: "codex",
      sourceEventType: sourceEventTypeFor(spec),
      kind: spec.kind,
      occurredAt:
        spec.occurredAt ??
        `2026-01-01T00:00:${String(sequence).padStart(2, "0")}.000Z`,
      entityId: spec.entityId,
      status: spec.status,
      title: titleFor(spec),
      evidenceLevel: evidenceLevelFor(spec.kind),
      attributes: attributesFor(spec),
      rawRef: {
        file:
          spec.rawFile ??
          `fixtures/comparisons/golden-set/${caseId}/${side}.jsonl`,
        sequence: spec.rawSequence ?? sequence,
      },
    };
  });
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function inspectCase(goldenCase: GoldenCase): GoldenCaseResult {
  const leftEvents = eventsFor(
    goldenCase.caseId,
    "left",
    goldenCase.leftEvents,
  );
  const rightEvents = eventsFor(
    goldenCase.caseId,
    "right",
    goldenCase.rightEvents,
  );
  const diff = compareTraces(leftEvents, rightEvents);
  const divergence = diff.firstObservableDivergence;
  const leftEvent = leftEvents.find(
    (event) => event.eventId === divergence?.leftEventId,
  );
  const rightEvent = rightEvents.find(
    (event) => event.eventId === divergence?.rightEventId,
  );
  const actualDivergence =
    divergence === undefined
      ? null
      : {
          alignmentIndex: divergence.alignmentIndex,
          relation: divergence.relation,
          leftSequence: leftEvent?.sequence ?? null,
          rightSequence: rightEvent?.sequence ?? null,
          reasonCodes: divergence.reasons.map((reason) => reason.code),
        };
  const failures: string[] = [];

  if (diff.alignment.status !== goldenCase.expected.alignmentStatus) {
    failures.push(
      `alignment status: expected ${goldenCase.expected.alignmentStatus}, received ${diff.alignment.status}`,
    );
  }

  if (
    goldenCase.expected.alignmentStatus === "ambiguous" &&
    diff.alignment.optimalPathCount !== "multiple"
  ) {
    failures.push("ambiguous case did not report multiple optimal paths");
  }

  if (
    goldenCase.expected.alignmentStatus === "resolved" &&
    diff.alignment.optimalPathCount !== 1
  ) {
    failures.push("resolved case did not report one optimal path");
  }

  if (
    !sameJson(actualDivergence, goldenCase.expected.firstDivergence)
  ) {
    failures.push(
      `first divergence: expected ${JSON.stringify(goldenCase.expected.firstDivergence)}, received ${JSON.stringify(actualDivergence)}`,
    );
  }

  if (!sameJson(diff.summary, goldenCase.expected.summary)) {
    failures.push(
      `summary: expected ${JSON.stringify(goldenCase.expected.summary)}, received ${JSON.stringify(diff.summary)}`,
    );
  }

  return {
    caseId: goldenCase.caseId,
    description: goldenCase.description,
    passed: failures.length === 0,
    failures,
    actual: {
      alignmentStatus: diff.alignment.status,
      optimalPathCount: diff.alignment.optimalPathCount,
      firstDivergence: actualDivergence,
    },
  };
}

function parseGoldenSet(value: string): GoldenSet {
  const parsed = JSON.parse(value) as Partial<GoldenSet>;

  if (
    parsed.schemaVersion !== "0.1" ||
    !Array.isArray(parsed.cases) ||
    parsed.cases.length === 0
  ) {
    throw new Error("Invalid or empty comparison golden set");
  }

  return parsed as GoldenSet;
}

export async function evaluateComparisonGoldenSet(
  fixtureFile = COMPARISON_GOLDEN_SET_FILE,
): Promise<GoldenSetReport> {
  const goldenSet = parseGoldenSet(await readFile(fixtureFile, "utf8"));
  const results = goldenSet.cases.map(inspectCase);
  const passed = results.filter((result) => result.passed).length;

  return {
    fixtureFile,
    total: results.length,
    passed,
    failed: results.length - passed,
    results,
  };
}
