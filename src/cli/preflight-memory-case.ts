import {
  preflightMemoryMatrix,
} from "../case-study/run-memory-matrix.js";

try {
  const result = await preflightMemoryMatrix();

  for (const check of result.checks) {
    console.log(`${check.passed ? "PASS" : "FAIL"}  ${check.name}`);
    console.log(`      ${check.detail}`);
  }

  console.log(`Preflight manifest: ${result.outputFile}`);

  if (!result.passed) {
    process.exitCode = 2;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
