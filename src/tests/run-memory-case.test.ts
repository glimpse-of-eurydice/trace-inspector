import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import type { RecordCodexTurnOptions } from "../collector/codex-app-server.js";
import type { TraceEvent } from "../core/trace-event.js";
import {
  detectMemoryExposure,
  runMemoryCase,
} from "../case-study/run-memory-case.js";
import {
  MEMORY_CASE_MODEL,
  MEMORY_CASE_REASONING_EFFORT,
} from "../case-study/memory-case-runtime.js";

const REPOSITORY_ROOT = fileURLToPath(new URL("../../", import.meta.url));

function commandEvent(
  sequence: number,
  kind: "command.started" | "command.completed",
  command: string,
): TraceEvent {
  return {
    schemaVersion: "0.1",
    eventId: `trace_test:${sequence}`,
    traceId: "trace_test",
    sequence,
    source: "codex",
    sourceEventType: kind === "command.started" ? "item/started" : "item/completed",
    kind,
    occurredAt: `2026-07-30T12:00:0${sequence}.000Z`,
    entityId: "command_001",
    status: kind === "command.started" ? "running" : "completed",
    title: `${kind === "command.started" ? "Command started" : "Command completed"}: ${command}`,
    evidenceLevel: "observed",
    attributes: {
      item: {
        type: "commandExecution",
        command,
      },
    },
    rawRef: {
      file: "raw.jsonl",
      sequence,
    },
  };
}

test("detects completed, incomplete, and absent memory exposure", () => {
  const started = commandEvent(
    1,
    "command.started",
    `/bin/zsh -lc "sed -n '1,220p' memory.md"`,
  );
  const completed = commandEvent(
    2,
    "command.completed",
    `/bin/zsh -lc "sed -n '1,220p' memory.md"`,
  );

  const statusOnly = commandEvent(
    3,
    "command.completed",
    "git status --short -- proposal.md memory.md",
  );

  assert.equal(detectMemoryExposure([started, completed]).status, "exposed");
  assert.equal(detectMemoryExposure([started]).status, "ambiguous");
  assert.equal(detectMemoryExposure([statusOnly]).status, "not_exposed");
  assert.equal(detectMemoryExposure([]).status, "not_exposed");
});

test("runs one isolated condition with injected collector dependencies", async () => {
  const temporaryRoot = await mkdtemp(
    join(tmpdir(), "trace-inspector-run-memory-case-"),
  );
  const runDirectory = join(temporaryRoot, "M1-R1");
  const ledgerPath = join(temporaryRoot, "run-ledger.jsonl");
  let observedRecordOptions: RecordCodexTurnOptions | undefined;

  try {
    const result = await runMemoryCase(
      {
        conditionId: "M1",
        repeatId: "R1",
        repositoryRoot: REPOSITORY_ROOT,
        outputDirectory: runDirectory,
        runLedgerPath: ledgerPath,
        now: new Date("2026-07-30T12:00:00.000Z"),
      },
      {
        recordTurn: async (options) => {
          observedRecordOptions = options;
          await writeFile(
            join(options.cwd, "proposal.md"),
            "# Sunday proposal\n\nA quieter plan.\n",
            "utf8",
          );

          return {
            traceId: "trace_test",
            traceDirectory: ".trace-inspector/traces/trace_test",
            rawFile: ".trace-inspector/traces/trace_test/raw.jsonl",
            eventCount: 2,
            status: "completed",
            collectorError: null,
            runtime: {
              userAgent: "Codex Desktop/test",
              cliVersion: "test",
              platformFamily: "unix",
              platformOs: "macos",
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
              runtimeWorkspaceRoots: [options.cwd],
              instructionSources: [],
              multiAgentMode: "explicitRequestOnly",
            },
          };
        },
        replay: async () => ({
          events: [
            commandEvent(1, "command.started", "cat memory.md"),
            commandEvent(2, "command.completed", "cat memory.md"),
          ],
          spans: [],
          findings: [],
        }),
      },
    );

    assert.equal(observedRecordOptions?.sandboxMode, "workspaceWrite");
    assert.equal(observedRecordOptions?.networkAccess, false);
    assert.equal(observedRecordOptions?.model, MEMORY_CASE_MODEL);
    assert.equal(
      observedRecordOptions?.reasoningEffort,
      MEMORY_CASE_REASONING_EFFORT,
    );
    assert.equal(result.exposure.status, "exposed");
    assert.deepEqual(result.workspaceAudit.changedFiles, ["proposal.md"]);
    assert.deepEqual(result.workspaceAudit.unexpectedChangedFiles, []);
    assert.equal(result.workspaceAudit.proposalNonBlank, true);
    assert.equal(result.passedStructuralChecks, true);

    const localManifest = JSON.parse(
      await readFile(result.runManifest, "utf8"),
    ) as {
      status: string;
      runId: string;
      trace: { traceId: string };
    };
    const ledger = await readFile(ledgerPath, "utf8");

    assert.equal(localManifest.status, "run-recorded");
    assert.equal(localManifest.runId, "M1-R1");
    assert.equal(localManifest.trace.traceId, "trace_test");
    assert.match(ledger, /"runId":"M1-R1"/);
  } finally {
    await rm(temporaryRoot, { recursive: true });
  }
});
