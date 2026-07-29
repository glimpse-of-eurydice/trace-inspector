import { runMemoryCase } from "../case-study/run-memory-case.js";

const [conditionArgument, repeatArgument, ...extraArguments] =
  process.argv.slice(2);

if (
  conditionArgument === undefined ||
  repeatArgument === undefined ||
  extraArguments.length > 0
) {
  console.error("Usage: npm run record:memory-case -- M1 R1");
  console.error("Conditions: M1, M2, M3");
  console.error("Repeats: R1, R2, R3");
  process.exitCode = 1;
} else {
  try {
    console.log(
      `Recording memory case ${conditionArgument.toUpperCase()}-${repeatArgument.toUpperCase()}...`,
    );
    const result = await runMemoryCase({
      conditionId: conditionArgument,
      repeatId: repeatArgument,
    });

    console.log(`Trace: ${result.trace.traceId} [${result.trace.status}]`);
    console.log(
      `Runtime: ${result.trace.runtime.model ?? "unknown model"} / ${result.trace.runtime.reasoningEffort ?? "unknown effort"} / Codex ${result.trace.runtime.cliVersion ?? "unknown version"}`,
    );
    console.log(
      `Sandbox: ${result.trace.runtime.sandbox?.type ?? "unknown"} / network=${String(result.trace.runtime.sandbox?.networkAccess ?? "unknown")}`,
    );
    console.log(`Workspace: ${result.prepared.workspaceDirectory}`);
    console.log(`Memory exposure: ${result.exposure.status}`);
    console.log(
      `Changed files: ${result.workspaceAudit.changedFiles.join(", ") || "(none)"}`,
    );
    console.log(
      `Unexpected changes: ${result.workspaceAudit.unexpectedChangedFiles.join(", ") || "(none)"}`,
    );
    console.log(
      `Proposal written: ${result.workspaceAudit.proposalNonBlank ? "yes" : "no"}`,
    );
    console.log(
      `Runtime metadata audit: ${result.runtimeAudit.passed ? "passed" : "failed"}`,
    );
    console.log(`Run manifest: ${result.runManifest}`);
    console.log(`Run ledger: ${result.runLedger}`);

    if (!result.passedStructuralChecks) {
      console.error(
        "The run was preserved, but one or more structural checks did not pass.",
      );
      process.exitCode = 2;
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
