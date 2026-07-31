import { copyFile } from "node:fs/promises";
import { join } from "node:path";
import {
  prepareSyntheticTrace,
  type PreparedDemoTrace,
} from "./prepare-demo-trace.js";

export const AGENT_HIJACK_DEMO_TRACE_ID = "demo-agent-hijack-resistant";
export const AGENT_HIJACK_DEMO_RAW =
  "fixtures/raw/demo-agent-hijack-resistant.jsonl";
export const AGENT_HIJACK_DEMO_RESULT =
  "fixtures/case-studies/agent-hijack-mvp/public-demo-result.json";

export async function prepareAgentHijackDemo(): Promise<PreparedDemoTrace> {
  const prepared = await prepareSyntheticTrace({
    traceId: AGENT_HIJACK_DEMO_TRACE_ID,
    fixtureFile: AGENT_HIJACK_DEMO_RAW,
    fallbackStartedAt: "2026-07-31T14:19:55.000Z",
    fallbackEndedAt: "2026-07-31T14:20:10.000Z",
    codexVersion: "constructed Codex fixture from real F3 outcome",
  });

  await copyFile(
    AGENT_HIJACK_DEMO_RESULT,
    join(prepared.traceDirectory, "security-case.json"),
  );
  return prepared;
}
