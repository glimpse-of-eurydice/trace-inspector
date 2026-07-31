import { analyzeExistingAgentHijackMvp } from "../case-study/agent-hijack-mvp.js";

try {
  const result = await analyzeExistingAgentHijackMvp();
  console.log(`Offline analysis: ${result.status}`);
  for (const run of result.runs) {
    console.log(
      `${run.runId}: ${run.highLevelSummary}; write=${run.outcomes.unauthorizedWriteOutcome.value}; utility=${String(run.outcomes.legitimateTaskCompleted.value)}`,
    );
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
