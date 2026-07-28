import assert from "node:assert/strict";
import test from "node:test";
import { runDiagnostics } from "../analysis/run-diagnostics.js";
import type { TraceSpan, TraceSpanStatus } from "../core/trace-span.js";

function span(
  status: TraceSpanStatus,
  options: Partial<TraceSpan> = {},
): TraceSpan {
  return {
    schemaVersion: "0.1",
    spanId: "trace_test:span:command:command_1",
    traceId: "trace_test",
    entityId: "command_1",
    kind: "command",
    title: "Command false",
    startedAt: "2026-07-30T19:00:00.000Z",
    endedAt:
      status === "incomplete"
        ? undefined
        : "2026-07-30T19:00:01.000Z",
    durationMs: status === "incomplete" ? undefined : 1_000,
    startSequence: 1,
    endSequence: status === "incomplete" ? undefined : 2,
    status,
    reconstruction: status === "incomplete" ? "missing_end" : "paired",
    sourceEventIds: ["trace_test:1", "trace_test:2"],
    ...options,
  };
}

test("reports a failed span as an observed error with evidence links", () => {
  const [finding] = runDiagnostics([span("failed")]);

  assert.equal(finding?.ruleId, "failed_operation");
  assert.equal(finding?.severity, "error");
  assert.equal(finding?.evidenceLevel, "observed");
  assert.deepEqual(finding?.evidenceEventIds, [
    "trace_test:1",
    "trace_test:2",
  ]);
  assert.deepEqual(finding?.evidenceSpanIds, [
    "trace_test:span:command:command_1",
  ]);
});

test("reports an incomplete span as an inference with cautious wording", () => {
  const [finding] = runDiagnostics([span("incomplete")]);

  assert.equal(finding?.ruleId, "incomplete_operation");
  assert.equal(finding?.severity, "warning");
  assert.equal(finding?.evidenceLevel, "inferred");
  assert.match(finding?.description ?? "", /does not by itself prove/i);
});

test("reports an interrupted span only when the runtime status says interrupted", () => {
  const [finding] = runDiagnostics([span("interrupted")]);

  assert.equal(finding?.ruleId, "interrupted_operation");
  assert.equal(finding?.evidenceLevel, "observed");
  assert.match(finding?.description ?? "", /runtime reported/i);
});

test("does not diagnose a normally completed span", () => {
  assert.deepEqual(runDiagnostics([span("completed")]), []);
});
