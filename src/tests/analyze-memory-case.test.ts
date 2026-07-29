import assert from "node:assert/strict";
import test from "node:test";
import {
  compareTraces,
  defaultComparisonPolicy,
} from "../analysis/compare-traces.js";
import {
  projectMemoryTrace,
  projectedEventsAfterExposure,
} from "../case-study/analyze-memory-case.js";
import type { TraceEvent } from "../core/trace-event.js";

function event(
  traceId: string,
  sequence: number,
  options: Partial<TraceEvent> & Pick<TraceEvent, "kind" | "sourceEventType">,
): TraceEvent {
  return {
    schemaVersion: "0.1",
    eventId: `${traceId}:${sequence}`,
    traceId,
    sequence,
    source: "codex",
    occurredAt: `2026-07-30T12:00:${String(sequence).padStart(2, "0")}.000Z`,
    title: options.title ?? options.kind,
    evidenceLevel: options.evidenceLevel ?? "observed",
    attributes: options.attributes ?? {},
    rawRef: {
      file: `${traceId}/raw.jsonl`,
      sequence,
    },
    ...options,
  };
}

function sourceTrace(traceId: string, memoryOutput: string): TraceEvent[] {
  return [
    event(traceId, 1, {
      kind: "turn.started",
      sourceEventType: "turn/started",
    }),
    event(traceId, 2, {
      kind: "message.output",
      sourceEventType: "item/agentMessage/delta",
      evidenceLevel: "model_reported",
      attributes: { delta: "streamed token" },
    }),
    event(traceId, 3, {
      kind: "command.started",
      sourceEventType: "item/started",
      attributes: {
        item: { command: `/bin/zsh -lc "cat memory.md"` },
      },
    }),
    event(traceId, 4, {
      kind: "command.completed",
      sourceEventType: "item/completed",
      status: "completed",
      attributes: {
        item: {
          command: `/bin/zsh -lc "cat memory.md"`,
          aggregatedOutput: memoryOutput,
        },
      },
    }),
    event(traceId, 5, {
      kind: "command.started",
      sourceEventType: "item/started",
      attributes: {
        item: { command: `/bin/zsh -lc "cat calendar.json"` },
      },
    }),
    event(traceId, 6, {
      kind: "command.completed",
      sourceEventType: "item/completed",
      status: "completed",
      attributes: {
        item: {
          command: `/bin/zsh -lc "cat calendar.json"`,
          aggregatedOutput: "same current evidence",
        },
      },
    }),
    event(traceId, 7, {
      kind: "unknown",
      sourceEventType: "item/completed",
      attributes: {
        item: {
          type: "fileChange",
          changes: [{ path: "/tmp/proposal.md", diff: "same proposal" }],
        },
      },
    }),
    event(traceId, 8, {
      kind: "token_usage.updated",
      sourceEventType: "thread/tokenUsage/updated",
    }),
    event(traceId, 9, {
      kind: "turn.completed",
      sourceEventType: "turn/completed",
      status: "completed",
    }),
  ];
}

test("operation projection aggregates command output and removes stream noise", () => {
  const projection = projectMemoryTrace(sourceTrace("left", "memory A"));

  assert.equal(
    projection.events.some(
      (candidate) => candidate.kind === "token_usage.updated",
    ),
    false,
  );
  assert.equal(
    projection.events.some(
      (candidate) =>
        candidate.kind === "message.output" &&
        candidate.attributes.delta === "streamed token",
    ),
    false,
  );
  assert.ok(
    projection.events.some(
      (candidate) =>
        candidate.kind === "command.output" &&
        candidate.attributes.delta === "memory A",
    ),
  );
  assert.ok(
    projection.events.some(
      (candidate) =>
        candidate.kind === "command.output" &&
        String(candidate.attributes.delta).includes("same proposal"),
    ),
  );
});

test("exposure-aware comparison removes the expected memory-content difference", () => {
  const left = projectMemoryTrace(sourceTrace("left", "memory A"));
  const right = projectMemoryTrace(sourceTrace("right", "memory B"));
  const generic = compareTraces(
    left.events,
    right.events,
    defaultComparisonPolicy(),
  );
  const downstream = compareTraces(
    projectedEventsAfterExposure(left, 4),
    projectedEventsAfterExposure(right, 4),
    defaultComparisonPolicy(),
  );

  assert.equal(generic.alignment.status, "resolved");
  assert.ok(generic.firstObservableDivergence);
  assert.equal(downstream.alignment.status, "resolved");
  assert.equal(downstream.firstObservableDivergence, undefined);
});
