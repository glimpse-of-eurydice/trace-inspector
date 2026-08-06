import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  DEMO_BASELINE_FIXTURE_FILE,
  DEMO_INTERVENTION_FILE,
} from "../demo/prepare-comparison-demo.js";
import {
  DEMO_FIXTURE_FILE,
  DEMO_TRACE_ID,
} from "../demo/prepare-demo-trace.js";
import { COMPARISON_GOLDEN_SET_FILE } from "../evaluation/evaluate-golden-set.js";
import {
  AGENT_HIJACK_DEMO_RAW,
  AGENT_HIJACK_DEMO_RESULT,
} from "../demo/prepare-agent-hijack-demo.js";
import {
  AGENT_HIJACK_F1_FIXTURE,
  AGENT_HIJACK_F2_FIXTURE,
  AGENT_HIJACK_INTERVENTION,
} from "../demo/prepare-agent-hijack-comparison-demo.js";

test("the committed demo fixtures contain no known private local paths", async () => {
  const fixtures = await Promise.all(
    [
      DEMO_FIXTURE_FILE,
      DEMO_BASELINE_FIXTURE_FILE,
      DEMO_INTERVENTION_FILE,
      COMPARISON_GOLDEN_SET_FILE,
      AGENT_HIJACK_DEMO_RAW,
      AGENT_HIJACK_DEMO_RESULT,
      AGENT_HIJACK_F1_FIXTURE,
      AGENT_HIJACK_F2_FIXTURE,
      AGENT_HIJACK_INTERVENTION,
    ].map((file) => readFile(file, "utf8")),
  );
  const forbiddenPatterns = [
    /\/Users\//i,
    /qiujingwen/i,
    /Documents\/trace inspector/i,
    /\.codex\//i,
    /github_pat_/i,
    /sk-[A-Za-z0-9_-]{12,}/,
  ];

  for (const fixture of fixtures) {
    for (const pattern of forbiddenPatterns) {
      assert.doesNotMatch(fixture, pattern);
    }
  }

  assert.match(DEMO_TRACE_ID, /^demo-[a-z-]+$/);
});
