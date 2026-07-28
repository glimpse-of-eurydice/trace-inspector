import {
  createTraceDirectory,
  readRawRecords,
  writeManifest,
  writeRawRecords,
} from "../store/trace-files.js";
import { replayTrace, type ReplayResult } from "../replay/replay-trace.js";

export const DEMO_TRACE_ID = "demo-failed-command";
export const DEMO_FIXTURE_FILE = "fixtures/raw/demo-failed-command.jsonl";

export interface PreparedDemoTrace {
  traceId: string;
  traceDirectory: string;
  replay: ReplayResult;
}

export async function prepareDemoTrace(): Promise<PreparedDemoTrace> {
  const rawRecords = await readRawRecords(DEMO_FIXTURE_FILE);
  const paths = await createTraceDirectory(DEMO_TRACE_ID);
  const startedAt =
    rawRecords[0]?.receivedAt ?? "2026-07-30T19:00:00.000Z";
  const endedAt =
    rawRecords.at(-1)?.receivedAt ?? "2026-07-30T19:00:06.000Z";

  await writeRawRecords(paths.raw, rawRecords);
  await writeManifest(paths.manifest, {
    traceFormatVersion: "0.1",
    traceId: DEMO_TRACE_ID,
    source: "codex",
    startedAt,
    endedAt,
    status: "completed",
    collectorVersion: "0.1.0",
    eventCount: rawRecords.length,
    containsSensitiveData: false,
    codexVersion: "synthetic Codex fixture",
  });

  const replay = await replayTrace(DEMO_TRACE_ID);

  return {
    traceId: DEMO_TRACE_ID,
    traceDirectory: paths.directory,
    replay,
  };
}
