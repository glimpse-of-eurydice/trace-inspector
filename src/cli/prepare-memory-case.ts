import { prepareMemoryCaseWorkspace } from "../case-study/prepare-memory-case.js";

const [conditionArgument, ...extraArguments] = process.argv.slice(2);

if (conditionArgument === undefined || extraArguments.length > 0) {
  console.error("Usage: npm run prepare:memory-case -- M1");
  console.error("Valid conditions: M1, M2, M3");
  process.exitCode = 1;
} else {
  try {
    const prepared = await prepareMemoryCaseWorkspace({
      conditionId: conditionArgument,
    });

    console.log(`Prepared ${prepared.conditionId}: ${prepared.conditionLabel}`);
    console.log(`Workspace: ${prepared.workspaceDirectory}`);
    console.log(`Run manifest: ${prepared.localRunManifest}`);
    console.log("Only proposal.md may be modified during the agent turn.");
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
