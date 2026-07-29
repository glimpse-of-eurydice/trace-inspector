import { analyzeMemoryCase } from "../case-study/analyze-memory-case.js";

try {
  const analysis = await analyzeMemoryCase();
  const primary = analysis.comparisons.filter(
    (comparison) => comparison.primaryDisplayPair,
  );

  console.log(`Analyzed ${analysis.runCount} memory-case runs.`);
  console.log(`Run table: ${analysis.runTableCsv}`);
  console.log(`Summary: ${analysis.summaryMarkdown}`);
  console.log(`Comparison index: ${analysis.comparisonIndex}`);

  for (const comparison of primary) {
    console.log(
      `${comparison.comparisonId}: generic=${comparison.genericAlignmentStatus} downstream=${comparison.downstreamStatus}`,
    );
  }

  console.log(
    `Blinded manual-review bundle: ${analysis.blindedReviewDirectory}`,
  );
  console.log(`Annotation template: ${analysis.manualReviewTemplate}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
