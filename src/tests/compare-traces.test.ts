import assert from "node:assert/strict";
import test from "node:test";
import {
  compareTraces,
  defaultComparisonPolicy,
} from "../analysis/compare-traces.js";
import { prepareComparisonDemo } from "../demo/prepare-comparison-demo.js";
import type { TraceEvent } from "../core/trace-event.js";

test("locates the constructed output change as the first observable divergence", async () => {
  const demo = await prepareComparisonDemo();
  const divergence = demo.diff.firstObservableDivergence;
  const leftEvent = demo.left.replay.events.find(
    (event) => event.eventId === divergence?.leftEventId,
  );
  const rightEvent = demo.right.replay.events.find(
    (event) => event.eventId === divergence?.rightEventId,
  );

  assert.equal(divergence?.alignmentIndex, 2);
  assert.equal(demo.diff.alignment.status, "resolved");
  assert.equal(demo.diff.alignment.optimalPathCount, 1);
  assert.equal(demo.diff.alignment.selectedPath, "unique_optimum");
  assert.equal(divergence?.relation, "changed");
  assert.equal(divergence?.evidenceLevel, "inferred");
  assert.equal(leftEvent?.kind, "command.output");
  assert.equal(rightEvent?.kind, "command.output");
  assert.equal(leftEvent?.sequence, 3);
  assert.equal(rightEvent?.sequence, 3);
  assert.deepEqual(
    divergence?.reasons.map((reason) => reason.code),
    ["output_changed"],
  );
  assert.deepEqual(demo.diff.summary, {
    same: 4,
    changed: 2,
    inserted: 1,
    deleted: 0,
  });
  assert.match(divergence?.claimBoundary ?? "", /not proof of the cause/i);
});

test("ignores event IDs, entity IDs, timestamps, and raw references", async () => {
  const demo = await prepareComparisonDemo();
  const rewritten = demo.left.replay.events.map(
    (event, index): TraceEvent => ({
      ...event,
      traceId: "rewritten_trace",
      eventId: `rewritten_trace:${index + 100}`,
      entityId: `rewritten_entity_${index}`,
      occurredAt: `2030-01-01T00:00:${String(index).padStart(2, "0")}.000Z`,
      rawRef: {
        file: `/different/raw/file-${index}.jsonl`,
        sequence: index + 100,
      },
    }),
  );
  const diff = compareTraces(demo.left.replay.events, rewritten);

  assert.equal(diff.firstObservableDivergence, undefined);
  assert.equal(diff.summary.same, demo.left.replay.events.length);
});

test("normalizes configured workspace roots before comparing commands", async () => {
  const demo = await prepareComparisonDemo();
  const left = demo.left.replay.events.slice(0, 2);
  const right = left.map((event) => ({ ...event }));
  const leftCommand = left[1];
  const rightCommand = right[1];

  if (leftCommand === undefined || rightCommand === undefined) {
    throw new Error("Demo did not contain a command start event");
  }

  leftCommand.attributes = {
    ...leftCommand.attributes,
    item: {
      type: "commandExecution",
      command: "cat /workspace/left/results.json",
    },
  };
  rightCommand.attributes = {
    ...rightCommand.attributes,
    item: {
      type: "commandExecution",
      command: "cat /workspace/right/results.json",
    },
  };

  const diff = compareTraces(
    left,
    right,
    defaultComparisonPolicy({
      leftWorkspaceRoot: "/workspace/left",
      rightWorkspaceRoot: "/workspace/right",
    }),
  );

  assert.equal(diff.firstObservableDivergence, undefined);
});

test("surfaces the variant-only plan update without losing later alignment", async () => {
  const demo = await prepareComparisonDemo();
  const inserted = demo.diff.alignedPairs.find(
    (pair) => pair.relation === "inserted",
  );
  const rightEvent = demo.right.replay.events.find(
    (event) => event.eventId === inserted?.rightEventId,
  );
  const laterTurnPair = demo.diff.alignedPairs.find(
    (pair) =>
      pair.alignmentIndex > (inserted?.alignmentIndex ?? Number.MAX_SAFE_INTEGER) &&
      demo.left.replay.events.find(
        (event) => event.eventId === pair.leftEventId,
      )?.kind === "turn.completed",
  );

  assert.equal(rightEvent?.kind, "plan.updated");
  assert.equal(inserted?.reasons[0]?.code, "right_event_only");
  assert.equal(laterTurnPair?.relation, "same");
});
