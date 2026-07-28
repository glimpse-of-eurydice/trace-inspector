import type { TraceEvent } from "../core/trace-event.js";
import type {
  TraceSpan,
  TraceSpanKind,
  TraceSpanStatus,
} from "../core/trace-span.js";

type OperationPhase = "start" | "output" | "end";

interface OperationDescriptor {
  kind: TraceSpanKind;
  phase: OperationPhase;
}

interface SpanDraft {
  span: TraceSpan;
  parentEntityId?: string;
}

function operationFor(event: TraceEvent): OperationDescriptor | undefined {
  switch (event.kind) {
    case "turn.started":
      return { kind: "turn", phase: "start" };
    case "turn.completed":
      return { kind: "turn", phase: "end" };
    case "message.started":
      return { kind: "message", phase: "start" };
    case "message.output":
      return { kind: "message", phase: "output" };
    case "message.completed":
      return { kind: "message", phase: "end" };
    case "command.started":
      return { kind: "command", phase: "start" };
    case "command.output":
      return { kind: "command", phase: "output" };
    case "command.completed":
      return { kind: "command", phase: "end" };
    default:
      return undefined;
  }
}

function readAttributeString(
  event: TraceEvent,
  key: string,
): string | undefined {
  const value = event.attributes[key];
  return typeof value === "string" ? value : undefined;
}

function operationKey(
  descriptor: OperationDescriptor,
  event: TraceEvent,
): string {
  return `${descriptor.kind}:${event.entityId ?? event.eventId}`;
}

function spanTitle(kind: TraceSpanKind, event: TraceEvent): string {
  if (kind === "turn") {
    return "Turn";
  }

  return event.title
    .replace(" started", "")
    .replace(" completed", "")
    .replace("Command:", "Command");
}

function completedStatus(event: TraceEvent): TraceSpanStatus {
  if (
    event.status === "failed" ||
    event.status === "interrupted" ||
    event.status === "completed"
  ) {
    return event.status;
  }

  return "completed";
}

function createStartedDraft(
  event: TraceEvent,
  descriptor: OperationDescriptor,
): SpanDraft {
  return {
    span: {
      schemaVersion: "0.1",
      spanId: `${event.traceId}:span:${descriptor.kind}:${event.entityId ?? event.eventId}`,
      traceId: event.traceId,
      entityId: event.entityId,
      kind: descriptor.kind,
      title: spanTitle(descriptor.kind, event),
      startedAt: event.occurredAt,
      startSequence: event.sequence,
      status: "incomplete",
      reconstruction: "missing_end",
      sourceEventIds: [event.eventId],
    },
    parentEntityId: readAttributeString(event, "turnId"),
  };
}

function createOrphanCompletionDraft(
  event: TraceEvent,
  descriptor: OperationDescriptor,
): SpanDraft {
  return {
    span: {
      schemaVersion: "0.1",
      spanId: `${event.traceId}:span:${descriptor.kind}:${event.entityId ?? event.eventId}`,
      traceId: event.traceId,
      entityId: event.entityId,
      kind: descriptor.kind,
      title: spanTitle(descriptor.kind, event),
      startedAt: event.occurredAt,
      endedAt: event.occurredAt,
      startSequence: event.sequence,
      endSequence: event.sequence,
      status: completedStatus(event),
      reconstruction: "missing_start",
      sourceEventIds: [event.eventId],
    },
    parentEntityId: readAttributeString(event, "turnId"),
  };
}

function closeDraft(draft: SpanDraft, event: TraceEvent): void {
  if (draft.span.endSequence !== undefined) {
    draft.span.sourceEventIds.push(event.eventId);
    return;
  }

  draft.span.endedAt = event.occurredAt;
  draft.span.endSequence = event.sequence;
  draft.span.status = completedStatus(event);
  draft.span.reconstruction = "paired";
  draft.span.sourceEventIds.push(event.eventId);

  const startTime = new Date(draft.span.startedAt).getTime();
  const endTime = new Date(event.occurredAt).getTime();

  if (endTime >= startTime) {
    draft.span.durationMs = endTime - startTime;
  } else {
    draft.span.timingWarning = "end_before_start";
  }
}

export function reconstructSpans(events: TraceEvent[]): TraceSpan[] {
  const sortedEvents = [...events].sort(
    (left, right) => left.sequence - right.sequence,
  );
  const drafts = new Map<string, SpanDraft>();
  const pendingOutputs = new Map<string, string[]>();

  for (const event of sortedEvents) {
    const descriptor = operationFor(event);

    if (descriptor === undefined) {
      continue;
    }

    const key = operationKey(descriptor, event);

    if (descriptor.phase === "output") {
      const draft = drafts.get(key);

      if (draft !== undefined) {
        draft.span.sourceEventIds.push(event.eventId);
      } else {
        const eventIds = pendingOutputs.get(key) ?? [];
        eventIds.push(event.eventId);
        pendingOutputs.set(key, eventIds);
      }
      continue;
    }

    if (descriptor.phase === "start") {
      const existing = drafts.get(key);

      if (existing !== undefined) {
        existing.span.sourceEventIds.push(event.eventId);
        continue;
      }

      const draft = createStartedDraft(event, descriptor);
      const outputEventIds = pendingOutputs.get(key);

      if (outputEventIds !== undefined) {
        draft.span.sourceEventIds.push(...outputEventIds);
        pendingOutputs.delete(key);
      }

      drafts.set(key, draft);
      continue;
    }

    const existing = drafts.get(key);

    if (existing === undefined) {
      const draft = createOrphanCompletionDraft(event, descriptor);
      const outputEventIds = pendingOutputs.get(key);

      if (outputEventIds !== undefined) {
        draft.span.sourceEventIds.unshift(...outputEventIds);
        pendingOutputs.delete(key);
      }

      drafts.set(key, draft);
    } else {
      closeDraft(existing, event);
    }
  }

  const turnSpansByEntity = new Map<string, string>();

  for (const draft of drafts.values()) {
    if (draft.span.kind === "turn" && draft.span.entityId !== undefined) {
      turnSpansByEntity.set(draft.span.entityId, draft.span.spanId);
    }
  }

  for (const draft of drafts.values()) {
    if (draft.parentEntityId !== undefined) {
      draft.span.parentSpanId = turnSpansByEntity.get(draft.parentEntityId);
    }
  }

  return [...drafts.values()]
    .map((draft) => draft.span)
    .sort(
      (left, right) =>
        left.startSequence - right.startSequence ||
        left.spanId.localeCompare(right.spanId),
    );
}
