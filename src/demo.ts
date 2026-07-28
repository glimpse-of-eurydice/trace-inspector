import type { TraceEvent } from "./core/trace-event.js";

const event: TraceEvent = {
  schemaVersion: "0.1",
  eventId: "event_001",
  traceId: "demo_trace",
  sequence: 1,
  source: "codex",
  sourceEventType: "turn/started",
  kind: "turn.started",
  occurredAt: "2026-07-30T19:00:00.000Z",
  status: "running",
  title: "Turn started",
  evidenceLevel: "observed",
  attributes: {},
  rawRef: {
    file: "manual-demo",
    sequence: 1,
  },
};

console.log(event);
