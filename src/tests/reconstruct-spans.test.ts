import assert from "node:assert/strict";
import test from "node:test";
import { reconstructSpans } from "../analysis/reconstruct-spans.js";
import type {
  TraceEvent,
  TraceEventKind,
  TraceEventStatus,
} from "../core/trace-event.js";

function event(
  sequence: number,
  kind: TraceEventKind,
  options: {
    entityId?: string;
    status?: TraceEventStatus;
    occurredAt?: string;
    attributes?: Record<string, unknown>;
  } = {},
): TraceEvent {
  return {
    schemaVersion: "0.1",
    eventId: `trace_test:${sequence}`,
    traceId: "trace_test",
    sequence,
    source: "codex",
    sourceEventType: kind,
    kind,
    occurredAt:
      options.occurredAt ??
      `2026-07-30T19:00:${String(sequence).padStart(2, "0")}.000Z`,
    entityId: options.entityId,
    status: options.status,
    title: kind,
    evidenceLevel: "observed",
    attributes: options.attributes ?? {},
    rawRef: {
      file: "fixtures/raw/test.jsonl",
      sequence,
    },
  };
}

test("pairs command events, includes output evidence, and links the parent turn", () => {
  const spans = reconstructSpans([
    event(1, "turn.started", {
      entityId: "turn_1",
      status: "running",
      occurredAt: "2026-07-30T19:00:00.000Z",
    }),
    event(2, "command.started", {
      entityId: "command_1",
      status: "running",
      occurredAt: "2026-07-30T19:00:01.000Z",
      attributes: { turnId: "turn_1" },
    }),
    event(3, "command.output", {
      entityId: "command_1",
      occurredAt: "2026-07-30T19:00:01.500Z",
    }),
    event(4, "command.completed", {
      entityId: "command_1",
      status: "failed",
      occurredAt: "2026-07-30T19:00:03.000Z",
      attributes: { turnId: "turn_1" },
    }),
    event(5, "turn.completed", {
      entityId: "turn_1",
      status: "completed",
      occurredAt: "2026-07-30T19:00:04.000Z",
    }),
  ]);

  const turn = spans.find((span) => span.kind === "turn");
  const command = spans.find((span) => span.kind === "command");

  assert.equal(turn?.status, "completed");
  assert.equal(command?.status, "failed");
  assert.equal(command?.durationMs, 2_000);
  assert.equal(command?.reconstruction, "paired");
  assert.equal(command?.parentSpanId, turn?.spanId);
  assert.deepEqual(command?.sourceEventIds, [
    "trace_test:2",
    "trace_test:3",
    "trace_test:4",
  ]);
});

test("marks a start without completion as an incomplete span", () => {
  const [span] = reconstructSpans([
    event(1, "message.started", {
      entityId: "message_1",
      status: "running",
    }),
  ]);

  assert.equal(span?.status, "incomplete");
  assert.equal(span?.reconstruction, "missing_end");
  assert.equal(span?.endSequence, undefined);
});

test("preserves a completion without a visible start", () => {
  const [span] = reconstructSpans([
    event(4, "message.completed", {
      entityId: "message_1",
      status: "completed",
    }),
  ]);

  assert.equal(span?.status, "completed");
  assert.equal(span?.reconstruction, "missing_start");
  assert.equal(span?.startSequence, 4);
  assert.equal(span?.endSequence, 4);
  assert.equal(span?.durationMs, undefined);
});

test("keeps duplicate completion evidence without moving the first end", () => {
  const [span] = reconstructSpans([
    event(1, "command.started", {
      entityId: "command_1",
      occurredAt: "2026-07-30T19:00:03.000Z",
    }),
    event(2, "command.completed", {
      entityId: "command_1",
      occurredAt: "2026-07-30T19:00:02.000Z",
    }),
    event(3, "command.completed", {
      entityId: "command_1",
      occurredAt: "2026-07-30T19:00:04.000Z",
    }),
  ]);

  assert.equal(span?.endSequence, 2);
  assert.equal(span?.timingWarning, "end_before_start");
  assert.equal(span?.durationMs, undefined);
  assert.deepEqual(span?.sourceEventIds, [
    "trace_test:1",
    "trace_test:2",
    "trace_test:3",
  ]);
});

test("uses received sequence even when input events are shuffled", () => {
  const [span] = reconstructSpans([
    event(2, "turn.completed", {
      entityId: "turn_1",
      status: "completed",
    }),
    event(1, "turn.started", {
      entityId: "turn_1",
      status: "running",
    }),
  ]);

  assert.equal(span?.startSequence, 1);
  assert.equal(span?.endSequence, 2);
  assert.equal(span?.reconstruction, "paired");
});
