import type {
  EvidenceLevel,
  TraceEvent,
  TraceEventKind,
  TraceEventStatus,
} from "../../core/trace-event.js";
import {
  asJsonObject,
  readCodexMessage,
  type RawTraceRecord,
} from "./raw-codex-message.js";

export interface NormalizeContext {
  traceId: string;
  rawFile: string;
}

function readString(object: Record<string, unknown> | undefined, key: string) {
  const value = object?.[key];
  return typeof value === "string" ? value : undefined;
}

function normalizeStatus(value: string | undefined): TraceEventStatus | undefined {
  switch (value) {
    case "inProgress":
      return "running";
    case "completed":
      return "completed";
    case "failed":
      return "failed";
    case "interrupted":
      return "interrupted";
    default:
      return undefined;
  }
}

function makeEvent(
  raw: RawTraceRecord,
  context: NormalizeContext,
  sourceEventType: string,
  kind: TraceEventKind,
  title: string,
  options: {
    entityId?: string;
    status?: TraceEventStatus;
    evidenceLevel?: EvidenceLevel;
    attributes?: Record<string, unknown>;
  } = {},
): TraceEvent {
  return {
    schemaVersion: "0.1",
    eventId: `${context.traceId}:${raw.sequence}`,
    traceId: context.traceId,
    sequence: raw.sequence,
    source: "codex",
    sourceEventType,
    kind,
    occurredAt: raw.receivedAt,
    entityId: options.entityId,
    status: options.status,
    title,
    evidenceLevel: options.evidenceLevel ?? "observed",
    attributes: options.attributes ?? {},
    rawRef: {
      file: context.rawFile,
      sequence: raw.sequence,
    },
  };
}

export function normalizeCodexMessage(
  raw: RawTraceRecord,
  context: NormalizeContext,
): TraceEvent[] {
  const message = readCodexMessage(raw.payload);

  if (message === undefined) {
    const envelope = asJsonObject(raw.payload);
    const requestId = envelope?.id;

    if (
      (typeof requestId === "string" || typeof requestId === "number") &&
      envelope !== undefined &&
      ("result" in envelope || "error" in envelope)
    ) {
      return [
        makeEvent(
          raw,
          context,
          "rpc/response",
          "rpc.response",
          `RPC response: request ${requestId}`,
          { attributes: envelope },
        ),
      ];
    }

    return [
      makeEvent(raw, context, "invalid", "unknown", "Invalid Codex message", {
        attributes: { payload: raw.payload },
      }),
    ];
  }

  const params = message.params;
  const item = asJsonObject(params?.item);
  const turn = asJsonObject(params?.turn);

  switch (message.method) {
    case "thread/started": {
      const thread = asJsonObject(params?.thread);
      return [
        makeEvent(
          raw,
          context,
          message.method,
          "thread.started",
          "Thread started",
          {
            entityId: readString(thread, "id"),
            status: "running",
            attributes: params,
          },
        ),
      ];
    }

    case "turn/started":
      return [
        makeEvent(raw, context, message.method, "turn.started", "Turn started", {
          entityId: readString(turn, "id"),
          status: normalizeStatus(readString(turn, "status")),
          attributes: params,
        }),
      ];

    case "item/started":
      if (readString(item, "type") === "commandExecution") {
        const command = readString(item, "command") ?? "Unknown command";
        return [
          makeEvent(
            raw,
            context,
            message.method,
            "command.started",
            `Command started: ${command}`,
            {
              entityId: readString(item, "id"),
              status: normalizeStatus(readString(item, "status")),
              attributes: params,
            },
          ),
        ];
      }

      if (
        readString(item, "type") === "userMessage" ||
        readString(item, "type") === "agentMessage"
      ) {
        const isAgent = readString(item, "type") === "agentMessage";
        return [
          makeEvent(
            raw,
            context,
            message.method,
            "message.started",
            `${isAgent ? "Agent" : "User"} message started`,
            {
              entityId: readString(item, "id"),
              status: "running",
              evidenceLevel: isAgent ? "model_reported" : "observed",
              attributes: params,
            },
          ),
        ];
      }
      break;

    case "item/agentMessage/delta":
      return [
        makeEvent(
          raw,
          context,
          message.method,
          "message.output",
          `Agent output: ${readString(params, "delta") ?? "(empty)"}`,
          {
            entityId: readString(params, "itemId"),
            evidenceLevel: "model_reported",
            attributes: params,
          },
        ),
      ];

    case "item/commandExecution/outputDelta":
      return [
        makeEvent(
          raw,
          context,
          message.method,
          "command.output",
          `Command output: ${readString(params, "delta") ?? "(empty)"}`,
          {
            entityId: readString(params, "itemId"),
            attributes: params,
          },
        ),
      ];

    case "item/completed":
      if (readString(item, "type") === "commandExecution") {
        const command = readString(item, "command") ?? "Unknown command";
        return [
          makeEvent(
            raw,
            context,
            message.method,
            "command.completed",
            `Command completed: ${command}`,
            {
              entityId: readString(item, "id"),
              status: normalizeStatus(readString(item, "status")),
              attributes: params,
            },
          ),
        ];
      }

      if (
        readString(item, "type") === "userMessage" ||
        readString(item, "type") === "agentMessage"
      ) {
        const isAgent = readString(item, "type") === "agentMessage";
        return [
          makeEvent(
            raw,
            context,
            message.method,
            "message.completed",
            `${isAgent ? "Agent" : "User"} message completed`,
            {
              entityId: readString(item, "id"),
              status: "completed",
              evidenceLevel: isAgent ? "model_reported" : "observed",
              attributes: params,
            },
          ),
        ];
      }
      break;

    case "turn/plan/updated": {
      const plan = Array.isArray(params?.plan) ? params.plan : [];
      const firstStep = asJsonObject(plan[0]);
      const step = readString(firstStep, "step");
      return [
        makeEvent(
          raw,
          context,
          message.method,
          "plan.updated",
          step === undefined ? "Plan updated" : `Plan updated: ${step}`,
          {
            entityId: readString(params, "turnId"),
            attributes: params,
          },
        ),
      ];
    }

    case "turn/completed":
      return [
        makeEvent(
          raw,
          context,
          message.method,
          "turn.completed",
          "Turn completed",
          {
            entityId: readString(turn, "id"),
            status: normalizeStatus(readString(turn, "status")),
            attributes: params,
          },
        ),
      ];

    case "thread/tokenUsage/updated": {
      const tokenUsage = asJsonObject(params?.tokenUsage);
      const total = asJsonObject(tokenUsage?.total);
      const totalTokens = total?.totalTokens;
      const title =
        typeof totalTokens === "number"
          ? `Token usage updated: ${totalTokens} total`
          : "Token usage updated";

      return [
        makeEvent(
          raw,
          context,
          message.method,
          "token_usage.updated",
          title,
          {
            entityId: readString(params, "turnId"),
            attributes: params,
          },
        ),
      ];
    }
  }

  return [
    makeEvent(
      raw,
      context,
      message.method,
      "unknown",
      `Unsupported event: ${message.method}`,
      { attributes: params },
    ),
  ];
}
