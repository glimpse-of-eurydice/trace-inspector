import {
  createTraceDirectory,
  readRawRecords,
  writeManifest,
  writeRawRecords,
} from "../store/trace-files.js";
import { replayTrace, type ReplayResult } from "../replay/replay-trace.js";

export const DEMO_TRACE_ID = "demo-failed-command";
export const DEMO_FIXTURE_FILE = "fixtures/raw/demo-failed-command.jsonl";

export interface SyntheticTraceDefinition {
  traceId: string;
  fixtureFile: string;
  fallbackStartedAt: string;
  fallbackEndedAt: string;
}

export interface PreparedDemoTrace {
  traceId: string;
  traceDirectory: string;
  replay: ReplayResult;
}

export async function prepareSyntheticTrace(
  definition: SyntheticTraceDefinition,
): Promise<PreparedDemoTrace> {
  const rawRecords = await readRawRecords(definition.fixtureFile);
  const paths = await createTraceDirectory(definition.traceId);
  const startedAt =
    rawRecords[0]?.receivedAt ?? definition.fallbackStartedAt;
  const endedAt =
    rawRecords.at(-1)?.receivedAt ?? definition.fallbackEndedAt;

  await writeRawRecords(paths.raw, rawRecords);
  await writeManifest(paths.manifest, {
    traceFormatVersion: "0.1",
    traceId: definition.traceId,
    source: "codex",
    startedAt,
    endedAt,
    status: "completed",
    collectorVersion: "0.1.0",
    eventCount: rawRecords.length,
    containsSensitiveData: false,
    codexVersion: "synthetic Codex fixture",
  });

  const replay = await replayTrace(definition.traceId);

  return {
    traceId: definition.traceId,
    traceDirectory: paths.directory,
    replay,
  };
}

export async function prepareDemoTrace(): Promise<PreparedDemoTrace> {
  return prepareSyntheticTrace({
    traceId: DEMO_TRACE_ID,
    fixtureFile: DEMO_FIXTURE_FILE,
    fallbackStartedAt: "2026-07-30T19:00:00.000Z",
    fallbackEndedAt: "2026-07-30T19:00:06.000Z",
  });
}
