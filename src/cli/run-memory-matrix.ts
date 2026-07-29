import {
  MEMORY_MATRIX_ORDER,
  runMemoryMatrix,
} from "../case-study/run-memory-matrix.js";

console.log(
  `Running ${MEMORY_MATRIX_ORDER.length} memory-case turns in predeclared interleaved order.`,
);
console.log("Failed or incomplete turns will be preserved and never retried.");

try {
  const result = await runMemoryMatrix({
    onRunStart: (runId, index) => {
      console.log(
        `\n[${index + 1}/${MEMORY_MATRIX_ORDER.length}] Starting ${runId}...`,
      );
    },
    onRunComplete: (runId, _index, summary) => {
      console.log(
        `${runId}: trace=${summary.traceId ?? "none"} status=${summary.traceStatus ?? "orchestration-error"} exposure=${summary.exposureStatus ?? "unknown"} structural=${String(summary.passedStructuralChecks)}`,
      );
      if (summary.orchestrationError !== null) {
        console.error(`${runId}: ${summary.orchestrationError}`);
      }
    },
  });

  console.log(`\nMatrix status: ${result.status}`);
  console.log(`Attempts recorded: ${result.attemptedRunCount}`);
  console.log(
    `Runtime consistency: ${result.runtimeConsistency?.passed === true ? "passed" : "failed"}`,
  );
  console.log(
    `Structural checks: ${result.allStructuralChecksPassed ? "passed" : "one or more failed"}`,
  );

  if (result.status !== "completed") {
    process.exitCode = 2;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
