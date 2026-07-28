import { normalizeCodexMessage } from "../adapters/codex/normalize-codex-message.js";
import type { TraceEvent } from "../core/trace-event.js";
import {
  readRawRecords,
  tracePaths,
  writeNormalizedEvents,
} from "../store/trace-files.js";

export async function replayTrace(traceId: string): Promise<TraceEvent[]> {
  const paths = tracePaths(traceId);
  const rawRecords = await readRawRecords(paths.raw);
  const events = rawRecords.flatMap((raw) =>
    normalizeCodexMessage(raw, {
      traceId,
      rawFile: paths.raw,
    }),
  );

  await writeNormalizedEvents(paths.events, events);
  return events;
}
