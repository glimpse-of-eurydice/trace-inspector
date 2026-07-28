import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateComparisonGoldenSet,
} from "../evaluation/evaluate-golden-set.js";

test("the comparison golden set matches all predeclared outcomes", async () => {
  const report = await evaluateComparisonGoldenSet();

  assert.equal(
    report.failed,
    0,
    report.results
      .flatMap((result) =>
        result.failures.map((failure) => `${result.caseId}: ${failure}`),
      )
      .join("\n"),
  );
  assert.equal(report.total, 8);
});

test("ambiguous golden cases withhold first observable divergence", async () => {
  const report = await evaluateComparisonGoldenSet();
  const ambiguous = report.results.filter(
    (result) => result.actual.alignmentStatus === "ambiguous",
  );

  assert.equal(ambiguous.length, 2);

  for (const result of ambiguous) {
    assert.equal(result.actual.optimalPathCount, "multiple");
    assert.equal(result.actual.firstDivergence, null);
  }
});
