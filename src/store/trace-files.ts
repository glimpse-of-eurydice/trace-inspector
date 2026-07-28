import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { TraceEvent } from "../core/trace-event.js";
import type { TraceSpan } from "../core/trace-span.js";
import type { DiagnosticFinding } from "../core/diagnostic-finding.js";
import {
  isRawTraceRecord,
  type RawTraceRecord,
} from "../adapters/codex/raw-codex-message.js";

export interface TraceManifest {
  traceFormatVersion: "0.1";
  traceId: string;
  source: "codex";
  startedAt: string;
  endedAt: string;
  status: "completed" | "failed" | "interrupted" | "incomplete";
  collectorVersion: "0.1.0";
  eventCount: number;
  containsSensitiveData: boolean;
  codexVersion: string;
}

export interface TracePaths {
  directory: string;
  manifest: string;
  raw: string;
  events: string;
  spans: string;
  findings: string;
}

export function tracePaths(traceId: string): TracePaths {
  const directory = join(".trace-inspector", "traces", traceId);

  return {
    directory,
    manifest: join(directory, "manifest.json"),
    raw: join(directory, "raw.jsonl"),
    events: join(directory, "events.jsonl"),
    spans: join(directory, "spans.jsonl"),
    findings: join(directory, "findings.jsonl"),
  };
}

export async function createTraceDirectory(traceId: string): Promise<TracePaths> {
  const paths = tracePaths(traceId);
  await mkdir(paths.directory, { recursive: true });
  return paths;
}

export async function appendRawRecord(
  file: string,
  record: RawTraceRecord,
): Promise<void> {
  await appendFile(file, `${JSON.stringify(record)}\n`, "utf8");
}

export async function writeRawRecords(
  file: string,
  records: RawTraceRecord[],
): Promise<void> {
  const jsonl = records.map((record) => JSON.stringify(record)).join("\n");
  await writeFile(file, jsonl.length === 0 ? "" : `${jsonl}\n`, "utf8");
}

export async function readRawRecords(file: string): Promise<RawTraceRecord[]> {
  const text = await readFile(file, "utf8");

  return text
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line, index) => {
      const value: unknown = JSON.parse(line);

      if (!isRawTraceRecord(value)) {
        throw new Error(`Invalid raw trace record on line ${index + 1}`);
      }

      return value;
    });
}

export async function writeNormalizedEvents(
  file: string,
  events: TraceEvent[],
): Promise<void> {
  const jsonl = events.map((event) => JSON.stringify(event)).join("\n");
  await writeFile(file, jsonl.length === 0 ? "" : `${jsonl}\n`, "utf8");
}

export async function writeSpans(
  file: string,
  spans: TraceSpan[],
): Promise<void> {
  const jsonl = spans.map((span) => JSON.stringify(span)).join("\n");
  await writeFile(file, jsonl.length === 0 ? "" : `${jsonl}\n`, "utf8");
}

export async function writeFindings(
  file: string,
  findings: DiagnosticFinding[],
): Promise<void> {
  const jsonl = findings.map((finding) => JSON.stringify(finding)).join("\n");
  await writeFile(file, jsonl.length === 0 ? "" : `${jsonl}\n`, "utf8");
}

export async function writeManifest(
  file: string,
  manifest: TraceManifest,
): Promise<void> {
  await writeFile(file, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}
