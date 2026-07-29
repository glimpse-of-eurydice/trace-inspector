import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { createInterface } from "node:readline";
import { asJsonObject } from "../adapters/codex/raw-codex-message.js";
import {
  emptyCodexRuntimeMetadata,
  type CodexRuntimeMetadata,
} from "../core/codex-runtime-metadata.js";
import {
  appendRawRecord,
  createTraceDirectory,
  writeManifest,
  type TraceManifest,
} from "../store/trace-files.js";
import { resolveCodexBinary } from "./resolve-codex-binary.js";

export interface RecordCodexTurnOptions {
  prompt: string;
  cwd: string;
  timeoutMs?: number;
  sandboxMode?: "readOnly" | "workspaceWrite";
  networkAccess?: boolean;
  model?: string;
  reasoningEffort?: string;
}

export interface RecordCodexTurnResult {
  traceId: string;
  traceDirectory: string;
  rawFile: string;
  eventCount: number;
  status: TraceManifest["status"];
  collectorError: string | null;
  runtime: CodexRuntimeMetadata;
}

function threadSandboxValue(
  sandboxMode: NonNullable<RecordCodexTurnOptions["sandboxMode"]>,
): "read-only" | "workspace-write" {
  return sandboxMode === "workspaceWrite"
    ? "workspace-write"
    : "read-only";
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

function nullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function readInitializeMetadata(
  message: unknown,
  current: CodexRuntimeMetadata,
): CodexRuntimeMetadata {
  const envelope = asJsonObject(message);
  const result = asJsonObject(envelope?.result);

  if (envelope?.id !== 0 || result === undefined) {
    return current;
  }

  return {
    ...current,
    userAgent: nullableString(result.userAgent),
    platformFamily: nullableString(result.platformFamily),
    platformOs: nullableString(result.platformOs),
  };
}

export function readThreadStartMetadata(
  message: unknown,
  current: CodexRuntimeMetadata = emptyCodexRuntimeMetadata(),
): CodexRuntimeMetadata {
  const envelope = asJsonObject(message);
  const result = asJsonObject(envelope?.result);
  const thread = asJsonObject(result?.thread);
  const sandbox = asJsonObject(result?.sandbox);

  if (envelope?.id !== 1 || result === undefined) {
    return current;
  }

  return {
    ...current,
    cliVersion: nullableString(thread?.cliVersion),
    model: nullableString(result.model),
    modelProvider: nullableString(result.modelProvider),
    serviceTier: nullableString(result.serviceTier),
    reasoningEffort: nullableString(result.reasoningEffort),
    approvalPolicy: nullableString(result.approvalPolicy),
    sandbox:
      sandbox === undefined
        ? null
        : {
            type: nullableString(sandbox.type),
            writableRoots: stringArray(sandbox.writableRoots),
            networkAccess:
              typeof sandbox.networkAccess === "boolean"
                ? sandbox.networkAccess
                : null,
          },
    runtimeWorkspaceRoots: stringArray(result.runtimeWorkspaceRoots),
    instructionSources: stringArray(result.instructionSources),
    multiAgentMode: nullableString(result.multiAgentMode),
  };
}

function readRequestError(message: unknown): string | undefined {
  const envelope = asJsonObject(message);
  const error = asJsonObject(envelope?.error);

  if (error === undefined) {
    return undefined;
  }

  const requestId = envelope?.id;
  const detail =
    typeof error.message === "string"
      ? error.message
      : JSON.stringify(error);

  return `Codex App Server request ${String(requestId)} failed: ${detail}`;
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
  const codexBinary = await resolveCodexBinary();
  const sandboxMode = options.sandboxMode ?? "readOnly";
  const child = spawn(codexBinary, ["app-server", "--stdio"], {
    cwd: options.cwd,
    stdio: ["pipe", "pipe", "pipe"],
  });
  const closed = once(child, "close");
  const lines = createInterface({ input: child.stdout });

  let sequence = 0;
  let status: TraceManifest["status"] = "incomplete";
  let collectorError: string | null = null;
  let runtime = emptyCodexRuntimeMetadata();
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
      const requestError = readRequestError(payload);

      if (requestError !== undefined) {
        collectorError = requestError;
        break;
      }

      runtime = readInitializeMetadata(payload, runtime);
      runtime = readThreadStartMetadata(payload, runtime);

      if (message?.id === 0 && "result" in message) {
        sendMessage(child.stdin, { method: "initialized", params: {} });
        sendMessage(child.stdin, {
          method: "thread/start",
          id: 1,
          params: {
            cwd: options.cwd,
            approvalPolicy: "never",
            sandbox: threadSandboxValue(sandboxMode),
            ephemeral: true,
            model: options.model,
          },
        });
      }

      if (message?.id === 1 && "result" in message) {
        const threadId = readResponseThreadId(payload);

        if (threadId === undefined) {
          throw new Error("thread/start response did not include a thread id");
        }

        const turnStartParams: Record<string, unknown> = {
          threadId,
          input: [
            {
              type: "text",
              text: options.prompt,
              text_elements: [],
            },
          ],
        };

        if (sandboxMode === "workspaceWrite") {
          turnStartParams.cwd = options.cwd;
          turnStartParams.approvalPolicy = "never";
          turnStartParams.sandboxPolicy = {
            type: "workspaceWrite",
            writableRoots: [options.cwd],
            networkAccess: options.networkAccess ?? false,
          };
        }

        if (options.model !== undefined) {
          turnStartParams.model = options.model;
        }

        if (options.reasoningEffort !== undefined) {
          turnStartParams.effort = options.reasoningEffort;
        }

        sendMessage(child.stdin, {
          method: "turn/start",
          id: 2,
          params: turnStartParams,
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
      codexVersion:
        runtime.cliVersion === null
          ? (runtime.userAgent ?? "unknown Codex runtime")
          : `codex-cli ${runtime.cliVersion}`,
      collectorError:
        timedOut
          ? `Codex turn timed out after ${timeoutMs} ms`
          : collectorError,
      runtime,
    });
  }

  if (timedOut) {
    collectorError = `Codex turn timed out after ${timeoutMs} ms`;
  }

  if (sequence === 0) {
    collectorError =
      `Codex App Server produced no JSONL messages.` +
      (stderr.trim() === "" ? "" : `\n${stderr.trim()}`);
  }

  return {
    traceId,
    traceDirectory: paths.directory,
    rawFile: paths.raw,
    eventCount: sequence,
    status,
    collectorError,
    runtime,
  };
}
