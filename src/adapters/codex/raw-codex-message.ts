export type JsonObject = Record<string, unknown>;

export interface RawTraceRecord {
  receivedAt: string;
  sequence: number;
  payload: unknown;
}

export interface RawCodexMessage {
  method: string;
  params?: JsonObject;
}

export function asJsonObject(value: unknown): JsonObject | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }

  return value as JsonObject;
}

export function isRawTraceRecord(value: unknown): value is RawTraceRecord {
  const object = asJsonObject(value);

  return (
    object !== undefined &&
    typeof object.receivedAt === "string" &&
    typeof object.sequence === "number" &&
    "payload" in object
  );
}

export function readCodexMessage(payload: unknown): RawCodexMessage | undefined {
  const object = asJsonObject(payload);

  if (object === undefined || typeof object.method !== "string") {
    return undefined;
  }

  return {
    method: object.method,
    params: asJsonObject(object.params),
  };
}
