import assert from "node:assert/strict";
import test from "node:test";
import { normalizeCodexMessage } from "../adapters/codex/normalize-codex-message.js";
import type { RawTraceRecord } from "../adapters/codex/raw-codex-message.js";

const context = {
  traceId: "test-trace",
  rawFile: "fixtures/raw/test.jsonl",
};

test("normalizes a turn/started message", () => {
  const raw: RawTraceRecord = {
    receivedAt: "2026-07-30T19:00:00.000Z",
    sequence: 1,
    payload: {
      method: "turn/started",
      params: {
        turn: { id: "turn_001", status: "inProgress" },
      },
    },
  };

  const [event] = normalizeCodexMessage(raw, context);

  assert.equal(event?.kind, "turn.started");
  assert.equal(event?.entityId, "turn_001");
  assert.equal(event?.status, "running");
  assert.equal(event?.evidenceLevel, "observed");
});

test("preserves an unsupported message as an unknown event", () => {
  const raw: RawTraceRecord = {
    receivedAt: "2026-07-30T19:00:00.000Z",
    sequence: 2,
    payload: {
      method: "custom/example",
      params: { note: "Keep me" },
    },
  };

  const [event] = normalizeCodexMessage(raw, context);

  assert.equal(event?.kind, "unknown");
  assert.equal(event?.sourceEventType, "custom/example");
  assert.deepEqual(event?.attributes, { note: "Keep me" });
});

test("marks agent message content as model-reported", () => {
  const raw: RawTraceRecord = {
    receivedAt: "2026-07-30T19:00:00.000Z",
    sequence: 3,
    payload: {
      method: "item/agentMessage/delta",
      params: {
        itemId: "message_001",
        delta: "Hello",
      },
    },
  };

  const [event] = normalizeCodexMessage(raw, context);

  assert.equal(event?.kind, "message.output");
  assert.equal(event?.evidenceLevel, "model_reported");
});

test("preserves JSON-RPC responses as observed events", () => {
  const raw: RawTraceRecord = {
    receivedAt: "2026-07-30T19:00:00.000Z",
    sequence: 4,
    payload: {
      id: 1,
      result: { thread: { id: "thread_001" } },
    },
  };

  const [event] = normalizeCodexMessage(raw, context);

  assert.equal(event?.kind, "rpc.response");
  assert.equal(event?.evidenceLevel, "observed");
});
