import assert from "node:assert/strict";
import test from "node:test";
import {
  auditRuntimeConsistency,
  MEMORY_MATRIX_ORDER,
  type MatrixRunSummary,
} from "../case-study/run-memory-matrix.js";
import type {
  CodexRuntimeMetadata,
} from "../core/codex-runtime-metadata.js";

function runtime(model = "gpt-5.6-sol"): CodexRuntimeMetadata {
  return {
    userAgent: "Codex Desktop/test",
    cliVersion: "test",
    platformFamily: "unix",
    platformOs: "macos",
    model,
    modelProvider: "openai",
    serviceTier: "priority",
    reasoningEffort: "medium",
    approvalPolicy: "never",
    sandbox: {
      type: "workspaceWrite",
      writableRoots: [],
      networkAccess: false,
    },
    runtimeWorkspaceRoots: ["/tmp/workspace"],
    instructionSources: [],
    multiAgentMode: "explicitRequestOnly",
  };
}

function summary(
  runId: string,
  metadata: CodexRuntimeMetadata,
): MatrixRunSummary {
  return {
    runId,
    attempted: true,
    orchestrationError: null,
    traceId: `trace-${runId}`,
    traceStatus: "completed",
    collectorError: null,
    exposureStatus: "exposed",
    proposalNonBlank: true,
    unexpectedChangedFiles: [],
    runtimeAuditPassed: true,
    passedStructuralChecks: true,
    runtime: metadata,
    runManifest: `${runId}/run-manifest.json`,
  };
}

test("uses the frozen interleaved nine-run order", () => {
  assert.deepEqual(MEMORY_MATRIX_ORDER, [
    "M1-R1",
    "M2-R1",
    "M3-R1",
    "M2-R2",
    "M3-R2",
    "M1-R2",
    "M3-R3",
    "M1-R3",
    "M2-R3",
  ]);
});

test("runtime consistency audit detects drift across runs", () => {
  const stable = [
    summary("M1-R1", runtime()),
    summary("M2-R1", runtime()),
  ];
  const drifted = [
    ...stable,
    summary("M3-R1", runtime("different-model")),
  ];

  assert.equal(auditRuntimeConsistency(stable).passed, true);
  const audit = auditRuntimeConsistency(drifted);
  assert.equal(audit.passed, false);
  assert.match(audit.mismatches.join("\n"), /M3-R1\.model/);
});
