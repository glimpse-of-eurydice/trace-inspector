import type { TraceEvent, TraceEventKind } from "../core/trace-event.js";

function laneFor(kind: TraceEventKind): string {
  if (kind.startsWith("turn.")) {
    return "TURN";
  }

  if (kind.startsWith("thread.")) {
    return "THREAD";
  }

  if (kind.startsWith("message.")) {
    return "MESSAGE";
  }

  if (kind.startsWith("command.")) {
    return "COMMAND";
  }

  if (kind.startsWith("plan.")) {
    return "PLAN";
  }

  if (kind.startsWith("token_usage.")) {
    return "USAGE";
  }

  if (kind.startsWith("rpc.")) {
    return "RPC";
  }

  return "UNKNOWN";
}

export function renderTerminalTimeline(events: TraceEvent[]): string {
  if (events.length === 0) {
    return "No events";
  }

  const lines = events.map((event) => {
    const time = event.occurredAt.slice(11, 19);
    const status = event.status === undefined ? "" : ` [${event.status}]`;
    const lane = laneFor(event.kind).padEnd(7);

    return `${String(event.sequence).padStart(2, "0")}  ${time}  ${lane}  ${event.title}${status}`;
  });

  return [
    `Trace ${events[0]?.traceId ?? "unknown"} (${events.length} events)`,
    "",
    ...lines,
  ].join("\n");
}
