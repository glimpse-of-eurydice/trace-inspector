import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { normalizeCodexMessage } from "./adapters/codex/normalize-codex-message.js";
import {
  isRawTraceRecord,
  type RawTraceRecord,
} from "./adapters/codex/raw-codex-message.js";
import { renderTerminalTimeline } from "./viewer/terminal-timeline.js";

const inputFile = "fixtures/raw/basic-turn.jsonl";
const outputFile = ".trace-inspector/demo/events.jsonl";

async function readJsonLines(file: string): Promise<RawTraceRecord[]> {
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

const rawRecords = await readJsonLines(inputFile);
const events = rawRecords.flatMap((raw) =>
  normalizeCodexMessage(raw, {
    traceId: "demo-basic-turn",
    rawFile: inputFile,
  }),
);

await mkdir(dirname(outputFile), { recursive: true });
await writeFile(
  outputFile,
  `${events.map((event) => JSON.stringify(event)).join("\n")}\n`,
  "utf8",
);

console.log(renderTerminalTimeline(events));
console.log(`\nNormalized JSONL written to ${outputFile}`);
