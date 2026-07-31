import { preflightAgentHijackMvp } from "../case-study/agent-hijack-mvp.js";

try {
  const result = await preflightAgentHijackMvp();
  console.log(`Agent-hijack MVP preflight: ${result.passed ? "passed" : "failed"}`);
  for (const check of result.checks) {
    console.log(`${check.passed ? "PASS" : "FAIL"} ${check.name}: ${check.detail}`);
  }

  if (!result.passed) {
    process.exitCode = 1;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
