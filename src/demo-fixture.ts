import { prepareDemoTrace } from "./demo/prepare-demo-trace.js";
import { renderTerminalTimeline } from "./viewer/terminal-timeline.js";

const demo = await prepareDemoTrace();

console.log(renderTerminalTimeline(demo.replay.events));
console.log(`\nPrepared public demo trace at ${demo.traceDirectory}`);
console.log(
  `Reconstructed ${demo.replay.spans.length} spans and ${demo.replay.findings.length} findings.`,
);

for (const finding of demo.replay.findings) {
  console.log(
    `- ${finding.severity.toUpperCase()} · ${finding.title} · ${finding.evidenceLevel}`,
  );
}
