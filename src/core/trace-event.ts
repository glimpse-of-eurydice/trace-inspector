export type EvidenceLevel =
  | "observed"
  | "model_reported"
  | "inferred";

export type TraceEventKind =
  | "rpc.response"
  | "thread.started"
  | "turn.started"
  | "message.started"
  | "message.output"
  | "message.completed"
  | "command.started"
  | "command.output"
  | "command.completed"
  | "file.started"
  | "file.completed"
  | "plan.updated"
  | "token_usage.updated"
  | "turn.completed"
  | "unknown";

export type TraceEventStatus =
  | "running"
  | "completed"
  | "failed"
  | "interrupted";

export interface TraceEvent {
  schemaVersion: "0.1";
  eventId: string;
  traceId: string;
  sequence: number;
  source: "codex";
  sourceEventType: string;
  kind: TraceEventKind;
  occurredAt: string;
  entityId?: string;
  status?: TraceEventStatus;
  title: string;
  evidenceLevel: EvidenceLevel;
  attributes: Record<string, unknown>;
  rawRef: {
    file: string;
    sequence: number;
  };
}
