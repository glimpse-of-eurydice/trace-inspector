import {
  evaluateComparisonGoldenSet,
} from "../evaluation/evaluate-golden-set.js";

try {
  const report = await evaluateComparisonGoldenSet();

  console.log(
    `Comparison golden set: ${report.passed}/${report.total} cases passed`,
  );

  for (const result of report.results) {
    const marker = result.passed ? "PASS" : "FAIL";
    const pathCount =
      result.actual.optimalPathCount === "multiple"
        ? "multiple optimal paths"
        : "unique optimum";
    console.log(
      `${marker}  ${result.caseId}  ${result.actual.alignmentStatus} · ${pathCount}`,
    );

    for (const failure of result.failures) {
      console.log(`      ${failure}`);
    }
  }

  if (report.failed > 0) {
    process.exitCode = 1;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
