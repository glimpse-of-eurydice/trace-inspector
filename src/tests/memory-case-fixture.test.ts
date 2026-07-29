import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";

interface ArtifactReference {
  path: string;
  sha256: string;
  sourcePath?: string;
}

interface ConditionReference {
  conditionId: string;
  sourcePath: string;
  sha256: string;
}

interface CaseManifest {
  sourceArtifacts: ArtifactReference[];
  intervention: {
    conditions: ConditionReference[];
  };
  heldVariables: {
    task: ArtifactReference;
    sharedWorkspace: ArtifactReference[];
  };
}

interface SourceManifest {
  selection: {
    selectedDialogueIds: string[];
    cutoff: {
      dialogueId: string;
    };
  };
}

interface RepresentationManifest {
  heldContentBoundary: {
    allowedFactIds: string[];
    sourceCutoffDialogueId: string;
  };
  lengthControl: {
    targetRange: {
      minimum: number;
      maximum: number;
    };
  };
  conditions: Array<{
    conditionId: string;
    file: string;
    includedFactIds: string[];
    omittedFactIds: string[];
    measuredWordCount: number;
  }>;
}

const REPOSITORY_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const CASE_MANIFEST_PATH =
  "fixtures/case-studies/memory-agent/case-manifest.json";
const SOURCE_MANIFEST_PATH =
  "case-studies/locomo-memory-action/source-manifest.json";
const REPRESENTATION_MANIFEST_PATH =
  "case-studies/locomo-memory-action/representation-manifest.json";

function repositoryPath(relativePath: string): string {
  return `${REPOSITORY_ROOT}${relativePath}`;
}

async function readJson<T>(relativePath: string): Promise<T> {
  return JSON.parse(
    await readFile(repositoryPath(relativePath), "utf8"),
  ) as T;
}

async function sha256(relativePath: string): Promise<string> {
  return createHash("sha256")
    .update(await readFile(repositoryPath(relativePath)))
    .digest("hex");
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).length;
}

test("memory case fixture artifacts match their frozen checksums", async () => {
  const manifest = await readJson<CaseManifest>(CASE_MANIFEST_PATH);
  const artifacts = [
    ...manifest.sourceArtifacts.map((artifact) => ({
      path: artifact.path,
      sha256: artifact.sha256,
    })),
    {
      path: manifest.heldVariables.task.path,
      sha256: manifest.heldVariables.task.sha256,
    },
    ...manifest.heldVariables.sharedWorkspace.map((artifact) => ({
      path: artifact.sourcePath ?? artifact.path,
      sha256: artifact.sha256,
    })),
    ...manifest.intervention.conditions.map((condition) => ({
      path: condition.sourcePath,
      sha256: condition.sha256,
    })),
  ];

  for (const artifact of artifacts) {
    assert.equal(
      await sha256(artifact.path),
      artifact.sha256,
      `${artifact.path} changed after the case was frozen`,
    );
  }
});

test("all memory conditions cover the same frozen facts within the length budget", async () => {
  const manifest = await readJson<RepresentationManifest>(
    REPRESENTATION_MANIFEST_PATH,
  );
  const allowedFactIds = [...manifest.heldContentBoundary.allowedFactIds].sort();

  for (const condition of manifest.conditions) {
    const memory = await readFile(repositoryPath(condition.file), "utf8");
    const citedFactIds = [...new Set(memory.match(/F\d{2}/g) ?? [])].sort();
    const measuredWords = wordCount(memory);

    assert.deepEqual([...condition.includedFactIds].sort(), allowedFactIds);
    assert.deepEqual(condition.omittedFactIds, []);
    assert.deepEqual(citedFactIds, allowedFactIds);
    assert.equal(measuredWords, condition.measuredWordCount);
    assert.ok(measuredWords >= manifest.lengthControl.targetRange.minimum);
    assert.ok(measuredWords <= manifest.lengthControl.targetRange.maximum);
  }
});

test("memory conditions cite no dialogue outside the frozen selection", async () => {
  const source = await readJson<SourceManifest>(SOURCE_MANIFEST_PATH);
  const representations = await readJson<RepresentationManifest>(
    REPRESENTATION_MANIFEST_PATH,
  );
  const selectedDialogueIds = new Set(source.selection.selectedDialogueIds);

  assert.equal(
    representations.heldContentBoundary.sourceCutoffDialogueId,
    source.selection.cutoff.dialogueId,
  );

  for (const condition of representations.conditions) {
    const memory = await readFile(repositoryPath(condition.file), "utf8");
    const dialogueIds = new Set(memory.match(/D\d+:\d+/g) ?? []);

    for (const dialogueId of dialogueIds) {
      assert.ok(
        selectedDialogueIds.has(dialogueId),
        `${condition.conditionId} cites unselected dialogue ${dialogueId}`,
      );
    }
  }
});

test("committed memory case artifacts contain no known private path or credential pattern", async () => {
  const manifest = await readJson<CaseManifest>(CASE_MANIFEST_PATH);
  const paths = [
    CASE_MANIFEST_PATH,
    SOURCE_MANIFEST_PATH,
    REPRESENTATION_MANIFEST_PATH,
    "case-studies/locomo-memory-action/evidence-ledger.json",
    manifest.heldVariables.task.path,
    ...manifest.heldVariables.sharedWorkspace.map(
      (artifact) => artifact.sourcePath ?? artifact.path,
    ),
    ...manifest.intervention.conditions.map(
      (condition) => condition.sourcePath,
    ),
  ];
  const forbiddenPatterns = [
    /\/Users\//i,
    /qiujingwen/i,
    /github_pat_/i,
    /sk-[A-Za-z0-9_-]{12,}/,
    /OPENAI_API_KEY/i,
  ];

  for (const path of paths) {
    const content = await readFile(repositoryPath(path), "utf8");

    for (const pattern of forbiddenPatterns) {
      assert.doesNotMatch(content, pattern, `${path} matched ${pattern}`);
    }
  }

  const gitignore = await readFile(repositoryPath(".gitignore"), "utf8");
  assert.match(gitignore, /^locomodata\/$/m);
});
