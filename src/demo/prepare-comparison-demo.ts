import { compareTraces, defaultComparisonPolicy } from "../analysis/compare-traces.js";
import type {
  InterventionManifest,
  TraceDiff,
} from "../core/trace-comparison.js";
import type { PreparedDemoTrace } from "./prepare-demo-trace.js";
import {
  prepareDemoTrace,
  prepareSyntheticTrace,
} from "./prepare-demo-trace.js";
import {
  createComparisonDirectory,
  readInterventionManifest,
  writeInterventionManifest,
  writeTraceDiff,
} from "../store/comparison-files.js";

export const DEMO_COMPARISON_ID = "demo-success-vs-failure";
export const DEMO_BASELINE_TRACE_ID = "demo-successful-command";
export const DEMO_BASELINE_FIXTURE_FILE =
  "fixtures/raw/demo-successful-command.jsonl";
export const DEMO_INTERVENTION_FILE =
  "fixtures/comparisons/success-vs-failure/intervention.json";

export interface PreparedComparisonDemo {
  comparisonId: string;
  comparisonDirectory: string;
  left: PreparedDemoTrace;
  right: PreparedDemoTrace;
  diff: TraceDiff;
  intervention: InterventionManifest;
}

export async function prepareComparisonDemo(): Promise<PreparedComparisonDemo> {
  const [left, right, intervention] = await Promise.all([
    prepareSyntheticTrace({
      traceId: DEMO_BASELINE_TRACE_ID,
      fixtureFile: DEMO_BASELINE_FIXTURE_FILE,
      fallbackStartedAt: "2026-07-30T21:00:00.000Z",
      fallbackEndedAt: "2026-07-30T21:00:06.000Z",
    }),
    prepareDemoTrace(),
    readInterventionManifest(DEMO_INTERVENTION_FILE),
  ]);
  const diff = compareTraces(
    left.replay.events,
    right.replay.events,
    defaultComparisonPolicy(),
  );
  const paths = await createComparisonDirectory(DEMO_COMPARISON_ID);

  await writeTraceDiff(paths.diff, diff);
  await writeInterventionManifest(paths.intervention, intervention);

  return {
    comparisonId: DEMO_COMPARISON_ID,
    comparisonDirectory: paths.directory,
    left,
    right,
    diff,
    intervention,
  };
}
