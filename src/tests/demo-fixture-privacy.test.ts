import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  DEMO_FIXTURE_FILE,
  DEMO_TRACE_ID,
} from "../demo/prepare-demo-trace.js";

test("the committed demo fixture contains no known private local paths", async () => {
  const fixture = await readFile(DEMO_FIXTURE_FILE, "utf8");
  const forbiddenPatterns = [
    /\/Users\//i,
    /qiujingwen/i,
    /Documents\/trace inspector/i,
    /\.codex\//i,
    /github_pat_/i,
    /sk-[A-Za-z0-9_-]{12,}/,
  ];

  for (const pattern of forbiddenPatterns) {
    assert.doesNotMatch(fixture, pattern);
  }

  assert.match(DEMO_TRACE_ID, /^demo-[a-z-]+$/);
});
