import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { createInterface } from "node:readline";
import { asJsonObject } from "../adapters/codex/raw-codex-message.js";
import {
  appendRawRecord,
  createTraceDirectory,
  writeManifest,
  type TraceManifest,
} from "../store/trace-files.js";

export interface RecordCodexTurnOptions {
  prompt: string;
  cwd: string;
  timeoutMs?: number;
}

export interface RecordCodexTurnResult {
  traceId: string;
  traceDirectory: string;
  rawFile: string;
  eventCount: number;
  status: TraceManifest["status"];
}

function createTraceId(): string {
  const time = new Date().toISOString().replaceAll(/[-:.TZ]/g, "");
  return `trace_${time}_${randomUUID().slice(0, 8)}`;
}

function sendMessage(
  stdin: NodeJS.WritableStream,
  message: Record<string, unknown>,
): void {
  stdin.write(`${JSON.stringify(message)}\n`);
}

function readResponseThreadId(message: unknown): string | undefined {
  const envelope = asJsonObject(message);
  const result = asJsonObject(envelope?.result);
  const thread = asJsonObject(result?.thread);
  return typeof thread?.id === "string" ? thread.id : undefined;
}

function readTurnCompletionStatus(
  message: unknown,
): TraceManifest["status"] | undefined {
  const envelope = asJsonObject(message);

  if (envelope?.method !== "turn/completed") {
    return undefined;
  }

  const params = asJsonObject(envelope.params);
  const turn = asJsonObject(params?.turn);
  const status = turn?.status;

  if (
    status === "completed" ||
    status === "failed" ||
    status === "interrupted"
  ) {
    return status;
  }

  return "incomplete";
}

export async function recordCodexTurn(
  options: RecordCodexTurnOptions,
): Promise<RecordCodexTurnResult> {
  const traceId = createTraceId();
  const paths = await createTraceDirectory(traceId);
  const startedAt = new Date().toISOString();
  const timeoutMs = options.timeoutMs ?? 120_000;
  const codexBinary = process.env.CODEX_BIN ?? "codex";
  const child = spawn(codexBinary, ["app-server", "--stdio"], {
    cwd: options.cwd,
    stdio: ["pipe", "pipe", "pipe"],
  });
  const closed = once(child, "close");
  const lines = createInterface({ input: child.stdout });

  let sequence = 0;
  let status: TraceManifest["status"] = "incomplete";
  let stderr = "";
  let timedOut = false;

  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk: string) => {
    stderr += chunk;
  });

  const timeout = setTimeout(() => {
    timedOut = true;
    child.kill("SIGTERM");
  }, timeoutMs);

  sendMessage(child.stdin, {
    method: "initialize",
    id: 0,
    params: {
      clientInfo: {
        name: "trace_inspector",
        title: "Trace Inspector",
        version: "0.1.0",
      },
      capabilities: null,
    },
  });

  try {
    for await (const line of lines) {
      let payload: unknown;

      try {
        payload = JSON.parse(line);
      } catch {
        payload = { malformedLine: line };
      }

      sequence += 1;
      await appendRawRecord(paths.raw, {
        receivedAt: new Date().toISOString(),
        sequence,
        payload,
      });

      const message = asJsonObject(payload);

      if (message?.id === 0 && "result" in message) {
        sendMessage(child.stdin, { method: "initialized", params: {} });
        sendMessage(child.stdin, {
          method: "thread/start",
          id: 1,
          params: {
            cwd: options.cwd,
            approvalPolicy: "never",
            sandbox: "read-only",
            ephemeral: true,
          },
        });
      }

      if (message?.id === 1 && "result" in message) {
        const threadId = readResponseThreadId(payload);

        if (threadId === undefined) {
          throw new Error("thread/start response did not include a thread id");
        }

        sendMessage(child.stdin, {
          method: "turn/start",
          id: 2,
          params: {
            threadId,
            input: [
              {
                type: "text",
                text: options.prompt,
                text_elements: [],
              },
            ],
          },
        });
      }

      const completionStatus = readTurnCompletionStatus(payload);

      if (completionStatus !== undefined) {
        status = completionStatus;
        break;
      }
    }
  } finally {
    clearTimeout(timeout);
    lines.close();

    if (child.exitCode === null && child.signalCode === null) {
      child.kill("SIGTERM");
    }

    await closed;

    await writeManifest(paths.manifest, {
      traceFormatVersion: "0.1",
      traceId,
      source: "codex",
      startedAt,
      endedAt: new Date().toISOString(),
      status,
      collectorVersion: "0.1.0",
      eventCount: sequence,
      containsSensitiveData: true,
      codexVersion: "codex-cli 0.145.0-alpha.18",
    });
  }

  if (timedOut) {
    throw new Error(`Codex turn timed out after ${timeoutMs} ms`);
  }

  if (sequence === 0) {
    throw new Error(
      `Codex App Server produced no JSONL messages.${stderr.trim() === "" ? "" : `\n${stderr.trim()}`}`,
    );
  }

  return {
    traceId,
    traceDirectory: paths.directory,
    rawFile: paths.raw,
    eventCount: sequence,
    status,
  };
}
