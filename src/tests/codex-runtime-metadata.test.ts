import assert from "node:assert/strict";
import test from "node:test";
import {
  readThreadStartMetadata,
} from "../collector/codex-app-server.js";
import {
  auditMemoryCaseRuntime,
  MEMORY_CASE_MODEL,
  MEMORY_CASE_REASONING_EFFORT,
} from "../case-study/memory-case-runtime.js";

test("extracts resolved runtime controls from thread/start", () => {
  const workspace = "/tmp/isolated-memory-case";
  const runtime = readThreadStartMetadata({
    id: 1,
    result: {
      thread: {
        cliVersion: "0.146.0-alpha.3.1",
      },
      model: MEMORY_CASE_MODEL,
      modelProvider: "openai",
      serviceTier: "priority",
      reasoningEffort: MEMORY_CASE_REASONING_EFFORT,
      approvalPolicy: "never",
      sandbox: {
        type: "workspaceWrite",
        writableRoots: [],
        networkAccess: false,
      },
      runtimeWorkspaceRoots: [workspace],
      instructionSources: [],
      multiAgentMode: "explicitRequestOnly",
    },
  });

  assert.equal(runtime.cliVersion, "0.146.0-alpha.3.1");
  assert.equal(runtime.model, MEMORY_CASE_MODEL);
  assert.equal(runtime.reasoningEffort, MEMORY_CASE_REASONING_EFFORT);
  assert.equal(runtime.sandbox?.networkAccess, false);

  const withInitializeMetadata = {
    ...runtime,
    userAgent: "Codex Desktop/test",
  };
  assert.deepEqual(
    auditMemoryCaseRuntime(withInitializeMetadata, workspace),
    {
      passed: true,
      missingFields: [],
      mismatches: [],
    },
  );
});

test("runtime audit rejects an unpinned model or network access", () => {
  const workspace = "/tmp/isolated-memory-case";
  const runtime = readThreadStartMetadata({
    id: 1,
    result: {
      thread: { cliVersion: "test" },
      model: "different-model",
      modelProvider: "openai",
      reasoningEffort: MEMORY_CASE_REASONING_EFFORT,
      approvalPolicy: "never",
      sandbox: {
        type: "workspaceWrite",
        networkAccess: true,
      },
      runtimeWorkspaceRoots: [workspace],
    },
  });
  const audit = auditMemoryCaseRuntime(
    { ...runtime, userAgent: "Codex Desktop/test" },
    workspace,
  );

  assert.equal(audit.passed, false);
  assert.ok(audit.mismatches.some((item) => item.startsWith("model:")));
  assert.ok(
    audit.mismatches.some((item) =>
      item.startsWith("sandbox.networkAccess:"),
    ),
  );
});
