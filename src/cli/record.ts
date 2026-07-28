import { recordCodexTurn } from "../collector/codex-app-server.js";
import { replayTrace } from "../replay/replay-trace.js";
import { renderTerminalTimeline } from "../viewer/terminal-timeline.js";

const prompt = process.argv.slice(2).join(" ").trim();

if (prompt.length === 0) {
  console.error('Usage: npm run record -- "Your Codex task"');
  process.exitCode = 1;
} else {
  console.log("Recording one Codex turn...");

  const result = await recordCodexTurn({
    prompt,
    cwd: process.cwd(),
  });
  const replay = await replayTrace(result.traceId);

  console.log(`\nSaved ${result.eventCount} raw messages to ${result.traceDirectory}`);
  console.log(renderTerminalTimeline(replay.events));
  console.log(`\nReconstructed ${replay.spans.length} spans.`);
  console.log(`Generated ${replay.findings.length} deterministic findings.`);
}
