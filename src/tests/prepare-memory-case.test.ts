import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  prepareMemoryCaseWorkspace,
  type MemoryConditionId,
} from "../case-study/prepare-memory-case.js";

const REPOSITORY_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const COMMON_FILES = [
  "task.md",
  "calendar.json",
  "recent-energy-log.json",
  "commitments.md",
  "proposal.md",
] as const;

test("prepares three isolated workspaces whose only differing file is memory.md", async () => {
  const temporaryRoot = await mkdtemp(
    join(tmpdir(), "trace-inspector-prepare-memory-case-"),
  );

  try {
    const conditions: MemoryConditionId[] = ["M1", "M2", "M3"];
    const prepared = await Promise.all(
      conditions.map((conditionId) =>
        prepareMemoryCaseWorkspace({
          conditionId,
          repositoryRoot: REPOSITORY_ROOT,
          outputDirectory: join(temporaryRoot, conditionId),
          preparedAt: new Date("2026-07-30T12:00:00.000Z"),
        }),
      ),
    );
    const commonChecksums = prepared.map((result) =>
      Object.fromEntries(
        COMMON_FILES.map((file) => [file, result.initialChecksums[file]]),
      ),
    );
    const memoryChecksums = prepared.map(
      (result) => result.initialChecksums["memory.md"],
    );

    assert.deepEqual(commonChecksums[1], commonChecksums[0]);
    assert.deepEqual(commonChecksums[2], commonChecksums[0]);
    assert.equal(new Set(memoryChecksums).size, 3);

    for (const result of prepared) {
      const localManifest = JSON.parse(
        await readFile(result.localRunManifest, "utf8"),
      ) as {
        conditionId: string;
        status: string;
        allowedWritableFiles: string[];
      };

      assert.equal(localManifest.conditionId, result.conditionId);
      assert.equal(localManifest.status, "prepared-not-run");
      assert.deepEqual(localManifest.allowedWritableFiles, ["proposal.md"]);
    }
  } finally {
    await rm(temporaryRoot, { recursive: true });
  }
});

test("rejects an undeclared memory condition", async () => {
  const temporaryRoot = await mkdtemp(
    join(tmpdir(), "trace-inspector-invalid-memory-case-"),
  );

  try {
    await assert.rejects(
      prepareMemoryCaseWorkspace({
        conditionId: "M4",
        repositoryRoot: REPOSITORY_ROOT,
        outputDirectory: join(temporaryRoot, "M4"),
      }),
      /Expected one of: M1, M2, M3/,
    );
  } finally {
    await rm(temporaryRoot, { recursive: true });
  }
});
