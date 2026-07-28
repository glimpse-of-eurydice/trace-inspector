import type {
  AlignedEventPair,
  ComparisonPolicy,
  ComparisonSide,
  DifferenceReason,
  TraceDiff,
} from "../core/trace-comparison.js";
import type { TraceEvent } from "../core/trace-event.js";

type MaterialField =
  | "command"
  | "status"
  | "output"
  | "plan"
  | "sourceEventType";

interface EventMaterial {
  kind: string;
  command?: string;
  status?: string;
  output?: string;
  plan?: string;
  sourceEventType?: string;
}

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

function stableJson(value: unknown): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJson(item) ?? "null").join(",")}]`;
  }

  const object = asObject(value);

  if (object !== undefined) {
    const entries = Object.entries(object)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(
        ([key, entryValue]) =>
          `${JSON.stringify(key)}:${stableJson(entryValue) ?? "null"}`,
      );
    return `{${entries.join(",")}}`;
  }

  return JSON.stringify(value);
}

function normalizeText(
  value: string | undefined,
  side: ComparisonSide,
  policy: ComparisonPolicy,
): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const workspaceRoot =
    side === "left"
      ? policy.normalization.leftWorkspaceRoot
      : policy.normalization.rightWorkspaceRoot;
  const withoutWorkspace =
    workspaceRoot === undefined
      ? value
      : value.replaceAll(
          workspaceRoot,
          policy.normalization.workspacePlaceholder,
        );

  return withoutWorkspace.trim().replaceAll(/\s+/g, " ");
}

function materialFor(
  event: TraceEvent,
  side: ComparisonSide,
  policy: ComparisonPolicy,
): EventMaterial {
  const item = asObject(event.attributes.item);
  const command = normalizeText(readString(item, "command"), side, policy);
  const output =
    event.kind === "command.output" || event.kind === "message.output"
      ? normalizeText(readString(event.attributes, "delta"), side, policy)
      : undefined;
  const plan =
    event.kind === "plan.updated"
      ? normalizeText(stableJson(event.attributes.plan), side, policy)
      : undefined;

  return {
    kind: event.kind,
    command,
    status: event.status,
    output,
    plan,
    sourceEventType:
      event.kind === "unknown" ? event.sourceEventType : undefined,
  };
}

function reason(
  code: DifferenceReason["code"],
  description: string,
): DifferenceReason {
  return { code, description };
}

function compareMaterial(
  left: TraceEvent,
  right: TraceEvent,
  policy: ComparisonPolicy,
): DifferenceReason[] {
  const leftMaterial = materialFor(left, "left", policy);
  const rightMaterial = materialFor(right, "right", policy);
  const reasons: DifferenceReason[] = [];

  if (leftMaterial.kind !== rightMaterial.kind) {
    reasons.push(
      reason(
        "event_kind_changed",
        `Event kind changed from ${leftMaterial.kind} to ${rightMaterial.kind}.`,
      ),
    );
  }

  const comparisons: Array<{
    field: MaterialField;
    code: DifferenceReason["code"];
    label: string;
  }> = [
    { field: "command", code: "command_changed", label: "Command" },
    { field: "status", code: "status_changed", label: "Status" },
    { field: "output", code: "output_changed", label: "Output" },
    { field: "plan", code: "plan_changed", label: "Plan" },
    {
      field: "sourceEventType",
      code: "source_event_type_changed",
      label: "Source event type",
    },
  ];

  for (const comparison of comparisons) {
    const leftValue = leftMaterial[comparison.field];
    const rightValue = rightMaterial[comparison.field];

    if (leftValue !== rightValue) {
      reasons.push(
        reason(
          comparison.code,
          `${comparison.label} changed from ${JSON.stringify(leftValue ?? "(none)")} to ${JSON.stringify(rightValue ?? "(none)")}.`,
        ),
      );
    }
  }

  return reasons;
}

function substitutionCost(
  left: TraceEvent,
  right: TraceEvent,
  policy: ComparisonPolicy,
): number {
  if (left.kind !== right.kind) {
    return policy.algorithm.differentKindSubstitutionCost;
  }

  return compareMaterial(left, right, policy).length === 0
    ? 0
    : policy.algorithm.sameKindChangeCost;
}

function createPolicy(
  options: {
    leftWorkspaceRoot?: string;
    rightWorkspaceRoot?: string;
  } = {},
): ComparisonPolicy {
  return {
    schemaVersion: "0.2",
    policyId: "v2-default",
    version: "0.2.0",
    algorithm: {
      name: "dynamic_programming_sequence_alignment",
      version: "0.2.0",
      insertionCost: 2,
      deletionCost: 2,
      sameKindChangeCost: 1,
      differentKindSubstitutionCost: 5,
      ambiguityDetection: "count_minimum_cost_paths",
      optimalPathCountLimit: 2,
    },
    comparedFields: [
      "kind",
      "command",
      "status",
      "output",
      "plan",
      "source_event_type",
    ],
    ignoredFields: [
      "event_id",
      "entity_id",
      "absolute_time",
      "raw_file",
      "raw_sequence",
    ],
    normalization: {
      collapseWhitespace: true,
      workspacePlaceholder: "<WORKSPACE>",
      leftWorkspaceRoot: options.leftWorkspaceRoot,
      rightWorkspaceRoot: options.rightWorkspaceRoot,
    },
  };
}

export function defaultComparisonPolicy(
  options: {
    leftWorkspaceRoot?: string;
    rightWorkspaceRoot?: string;
  } = {},
): ComparisonPolicy {
  return createPolicy(options);
}

function matrixValue(matrix: number[][], row: number, column: number): number {
  const value = matrix[row]?.[column];

  if (value === undefined) {
    throw new Error(`Missing alignment matrix value at ${row}, ${column}`);
  }

  return value;
}

function cappedPathCount(...counts: number[]): number {
  return Math.min(2, counts.reduce((total, count) => total + count, 0));
}

export function compareTraces(
  leftEvents: TraceEvent[],
  rightEvents: TraceEvent[],
  policy = defaultComparisonPolicy(),
): TraceDiff {
  const left = [...leftEvents].sort(
    (first, second) => first.sequence - second.sequence,
  );
  const right = [...rightEvents].sort(
    (first, second) => first.sequence - second.sequence,
  );
  const costs = Array.from({ length: left.length + 1 }, () =>
    Array<number>(right.length + 1).fill(0),
  );
  const pathCounts = Array.from({ length: left.length + 1 }, () =>
    Array<number>(right.length + 1).fill(0),
  );
  const firstPathCountRow = pathCounts[0];

  if (firstPathCountRow === undefined) {
    throw new Error("Alignment path-count matrix is empty");
  }

  firstPathCountRow[0] = 1;

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const row = costs[leftIndex];
    const pathCountRow = pathCounts[leftIndex];

    if (row !== undefined) {
      row[0] = leftIndex * policy.algorithm.deletionCost;
    }

    if (pathCountRow !== undefined) {
      pathCountRow[0] = 1;
    }
  }

  const firstRow = costs[0];

  if (firstRow === undefined) {
    throw new Error("Alignment matrix is empty");
  }

  for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
    firstRow[rightIndex] = rightIndex * policy.algorithm.insertionCost;
    firstPathCountRow[rightIndex] = 1;
  }

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    for (
      let rightIndex = 1;
      rightIndex <= right.length;
      rightIndex += 1
    ) {
      const leftEvent = left[leftIndex - 1];
      const rightEvent = right[rightIndex - 1];

      if (leftEvent === undefined || rightEvent === undefined) {
        throw new Error("Alignment input changed while building the matrix");
      }

      const diagonal =
        matrixValue(costs, leftIndex - 1, rightIndex - 1) +
        substitutionCost(leftEvent, rightEvent, policy);
      const deleted =
        matrixValue(costs, leftIndex - 1, rightIndex) +
        policy.algorithm.deletionCost;
      const inserted =
        matrixValue(costs, leftIndex, rightIndex - 1) +
        policy.algorithm.insertionCost;
      const row = costs[leftIndex];
      const pathCountRow = pathCounts[leftIndex];
      const minimum = Math.min(diagonal, deleted, inserted);

      if (row !== undefined) {
        row[rightIndex] = minimum;
      }

      if (pathCountRow !== undefined) {
        pathCountRow[rightIndex] = cappedPathCount(
          diagonal === minimum
            ? matrixValue(pathCounts, leftIndex - 1, rightIndex - 1)
            : 0,
          deleted === minimum
            ? matrixValue(pathCounts, leftIndex - 1, rightIndex)
            : 0,
          inserted === minimum
            ? matrixValue(pathCounts, leftIndex, rightIndex - 1)
            : 0,
        );
      }
    }
  }

  const optimalCost = matrixValue(costs, left.length, right.length);
  const optimalPathCount = matrixValue(
    pathCounts,
    left.length,
    right.length,
  );
  const alignmentStatus =
    optimalPathCount === 1 ? "resolved" : "ambiguous";

  const reversedPairs: Omit<AlignedEventPair, "alignmentIndex">[] = [];
  let leftIndex = left.length;
  let rightIndex = right.length;

  while (leftIndex > 0 || rightIndex > 0) {
    const current = matrixValue(costs, leftIndex, rightIndex);
    const leftEvent = left[leftIndex - 1];
    const rightEvent = right[rightIndex - 1];

    if (leftEvent !== undefined && rightEvent !== undefined) {
      const diagonal =
        matrixValue(costs, leftIndex - 1, rightIndex - 1) +
        substitutionCost(leftEvent, rightEvent, policy);

      if (current === diagonal && leftEvent.kind === rightEvent.kind) {
        const reasons = compareMaterial(leftEvent, rightEvent, policy);
        reversedPairs.push({
          leftEventId: leftEvent.eventId,
          rightEventId: rightEvent.eventId,
          relation: reasons.length === 0 ? "same" : "changed",
          reasons,
        });
        leftIndex -= 1;
        rightIndex -= 1;
        continue;
      }
    }

    const deletionCost =
      leftIndex > 0
        ? matrixValue(costs, leftIndex - 1, rightIndex) +
          policy.algorithm.deletionCost
        : Number.POSITIVE_INFINITY;
    const insertionCost =
      rightIndex > 0
        ? matrixValue(costs, leftIndex, rightIndex - 1) +
          policy.algorithm.insertionCost
        : Number.POSITIVE_INFINITY;

    if (leftEvent !== undefined && current === deletionCost) {
      reversedPairs.push({
        leftEventId: leftEvent.eventId,
        relation: "deleted",
        reasons: [
          reason(
            "left_event_only",
            "An event was observed only in the left trace under this alignment.",
          ),
        ],
      });
      leftIndex -= 1;
      continue;
    }

    if (rightEvent !== undefined && current === insertionCost) {
      reversedPairs.push({
        rightEventId: rightEvent.eventId,
        relation: "inserted",
        reasons: [
          reason(
            "right_event_only",
            "An event was observed only in the right trace under this alignment.",
          ),
        ],
      });
      rightIndex -= 1;
      continue;
    }

    if (leftEvent !== undefined && rightEvent !== undefined) {
      const reasons = compareMaterial(leftEvent, rightEvent, policy);
      reversedPairs.push({
        leftEventId: leftEvent.eventId,
        rightEventId: rightEvent.eventId,
        relation: "changed",
        reasons,
      });
      leftIndex -= 1;
      rightIndex -= 1;
      continue;
    }

    throw new Error("Unable to backtrack deterministic trace alignment");
  }

  const alignedPairs = reversedPairs
    .reverse()
    .map((pair, alignmentIndex) => ({ ...pair, alignmentIndex }));
  const firstChanged = alignedPairs.find(
    (
      pair,
    ): pair is AlignedEventPair & {
      relation: Exclude<AlignedEventPair["relation"], "same">;
    } => pair.relation !== "same",
  );
  const summary = {
    same: alignedPairs.filter((pair) => pair.relation === "same").length,
    changed: alignedPairs.filter((pair) => pair.relation === "changed").length,
    inserted: alignedPairs.filter((pair) => pair.relation === "inserted").length,
    deleted: alignedPairs.filter((pair) => pair.relation === "deleted").length,
  };

  return {
    schemaVersion: "0.2",
    diffId: `diff:${left[0]?.traceId ?? "empty"}:${right[0]?.traceId ?? "empty"}:${policy.policyId}:${policy.version}`,
    leftTraceId: left[0]?.traceId ?? "empty-left-trace",
    rightTraceId: right[0]?.traceId ?? "empty-right-trace",
    policy,
    alignment: {
      status: alignmentStatus,
      optimalCost,
      optimalPathCount: optimalPathCount === 1 ? 1 : "multiple",
      pathCountLimit: 2,
      selectedPath:
        alignmentStatus === "resolved"
          ? "unique_optimum"
          : "deterministic_preview",
      evidenceLevel: "inferred",
      claimBoundary:
        alignmentStatus === "resolved"
          ? "The minimum-cost alignment is unique under this policy and version."
          : "At least two minimum-cost alignments exist. Aligned pairs are a deterministic preview only, so first observable divergence is withheld.",
    },
    alignedPairs,
    firstObservableDivergence:
      firstChanged === undefined || alignmentStatus === "ambiguous"
        ? undefined
        : {
            alignmentIndex: firstChanged.alignmentIndex,
            leftEventId: firstChanged.leftEventId,
            rightEventId: firstChanged.rightEventId,
            relation: firstChanged.relation,
            reasons: firstChanged.reasons,
            evidenceLevel: "inferred",
            claimBoundary:
              "This is the first observable difference under the selected comparison policy, not proof of the cause of later behavior.",
          },
    summary,
  };
}
