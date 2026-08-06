import { compareTraces, defaultComparisonPolicy } from "../analysis/compare-traces.js";
import type { InterventionManifest, TraceDiff } from "../core/trace-comparison.js";
import type { PreparedDemoTrace } from "./prepare-demo-trace.js";
import { prepareSyntheticTrace } from "./prepare-demo-trace.js";
import {
  createComparisonDirectory,
  readInterventionManifest,
  writeInterventionManifest,
  writeTraceDiff,
} from "../store/comparison-files.js";

export const AGENT_HIJACK_COMPARISON_ID = "agent-hijack-f1-vs-f2";
export const AGENT_HIJACK_F1_TRACE_ID = "demo-agent-hijack-f1";
export const AGENT_HIJACK_F2_TRACE_ID = "demo-agent-hijack-f2";
export const AGENT_HIJACK_F1_FIXTURE = "fixtures/raw/demo-agent-hijack-f1.jsonl";
export const AGENT_HIJACK_F2_FIXTURE = "fixtures/raw/demo-agent-hijack-f2.jsonl";
export const AGENT_HIJACK_INTERVENTION =
  "fixtures/comparisons/agent-hijack-f1-vs-f2/intervention.json";

export interface PreparedAgentHijackComparisonDemo {
  comparisonId: string;
  comparisonDirectory: string;
  left: PreparedDemoTrace;
  right: PreparedDemoTrace;
  diff: TraceDiff;
  intervention: InterventionManifest;
}

export async function prepareAgentHijackComparisonDemo(): Promise<PreparedAgentHijackComparisonDemo> {
  const [left, right, intervention] = await Promise.all([
    prepareSyntheticTrace({
      traceId: AGENT_HIJACK_F1_TRACE_ID,
      fixtureFile: AGENT_HIJACK_F1_FIXTURE,
      fallbackStartedAt: "2026-07-31T14:19:15.000Z",
      fallbackEndedAt: "2026-07-31T14:19:18.100Z",
      codexVersion: "constructed Codex fixture from real F1 outcome",
    }),
    prepareSyntheticTrace({
      traceId: AGENT_HIJACK_F2_TRACE_ID,
      fixtureFile: AGENT_HIJACK_F2_FIXTURE,
      fallbackStartedAt: "2026-07-31T14:19:35.000Z",
      fallbackEndedAt: "2026-07-31T14:19:39.100Z",
      codexVersion: "constructed Codex fixture from real F2 outcome",
    }),
    readInterventionManifest(AGENT_HIJACK_INTERVENTION),
  ]);
  const diff = compareTraces(
    left.replay.events,
    right.replay.events,
    defaultComparisonPolicy(),
  );
  const paths = await createComparisonDirectory(AGENT_HIJACK_COMPARISON_ID);
  await writeTraceDiff(paths.diff, diff);
  await writeInterventionManifest(paths.intervention, intervention);
  return {
    comparisonId: AGENT_HIJACK_COMPARISON_ID,
    comparisonDirectory: paths.directory,
    left,
    right,
    diff,
    intervention,
  };
}
