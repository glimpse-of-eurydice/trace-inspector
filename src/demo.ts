import type { TraceEvent } from "./core/trace-event.js";

const event: TraceEvent = {
  eventId: "event_001",
  sequence: 1,
  title: "Turn started",
  evidenceLevel: "observed",
};

console.log(event);