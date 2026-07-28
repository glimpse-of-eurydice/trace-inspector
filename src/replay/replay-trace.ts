import { normalizeCodexMessage } from "../adapters/codex/normalize-codex-message.js";
import { reconstructSpans } from "../analysis/reconstruct-spans.js";
import type { TraceEvent } from "../core/trace-event.js";
import type { TraceSpan } from "../core/trace-span.js";
import {
  readRawRecords,
  tracePaths,
  writeNormalizedEvents,
  writeSpans,
} from "../store/trace-files.js";

export interface ReplayResult {
  events: TraceEvent[];
  spans: TraceSpan[];
}

export async function replayTrace(traceId: string): Promise<ReplayResult> {
  const paths = tracePaths(traceId);
  const rawRecords = await readRawRecords(paths.raw);
  const events = rawRecords.flatMap((raw) =>
    normalizeCodexMessage(raw, {
      traceId,
      rawFile: paths.raw,
    }),
  );
  const spans = reconstructSpans(events);

  await writeNormalizedEvents(paths.events, events);
  await writeSpans(paths.spans, spans);
  return { events, spans };
}
