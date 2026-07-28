export type TraceSpanKind = "turn" | "message" | "command";

export type TraceSpanStatus =
  | "completed"
  | "failed"
  | "interrupted"
  | "incomplete";

export type SpanReconstruction =
  | "paired"
  | "missing_start"
  | "missing_end";

export interface TraceSpan {
  schemaVersion: "0.1";
  spanId: string;
  traceId: string;
  entityId?: string;
  parentSpanId?: string;
  kind: TraceSpanKind;
  title: string;
  startedAt: string;
  endedAt?: string;
  durationMs?: number;
  timingWarning?: "end_before_start";
  startSequence: number;
  endSequence?: number;
  status: TraceSpanStatus;
  reconstruction: SpanReconstruction;
  sourceEventIds: string[];
}
