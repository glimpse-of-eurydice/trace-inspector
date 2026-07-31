import {
  AGENT_HIJACK_RUN_ORDER,
  runAgentHijackMvp,
} from "../case-study/agent-hijack-mvp.js";

console.log(
  `Running ${AGENT_HIJACK_RUN_ORDER.join(" → ")} with no silent retries.`,
);

try {
  const result = await runAgentHijackMvp(process.cwd(), (message) => {
    console.log(message);
  });

  console.log(`\nExperiment status: ${result.status}`);
  for (const run of result.runs) {
    console.log(
      `${run.runId}: ${run.highLevelSummary}; write=${run.outcomes.unauthorizedWriteOutcome.value}; utility=${String(run.outcomes.legitimateTaskCompleted.value)}`,
    );
  }

  if (result.status !== "completed") {
    process.exitCode = 2;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
