import { access, readdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tracePaths } from "../store/trace-files.js";
import { startTimelineServer } from "../server/timeline-server.js";
import { replayTrace } from "../replay/replay-trace.js";
import {
  DEMO_TRACE_ID,
  prepareDemoTrace,
} from "../demo/prepare-demo-trace.js";

async function latestTraceId(): Promise<string> {
  const entries = await readdir(".trace-inspector/traces", {
    withFileTypes: true,
  });
  const traceIds = entries
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("trace_"))
    .map((entry) => entry.name)
    .sort()
    .reverse();
  const latest = traceIds[0];

  if (latest === undefined) {
    throw new Error("No recorded traces found. Run npm run record first.");
  }

  return latest;
}

async function resolveTraceId(argument: string | undefined): Promise<string> {
  if (argument === "demo") {
    await prepareDemoTrace();
    return DEMO_TRACE_ID;
  }

  const traceId =
    argument === undefined || argument === "latest"
      ? await latestTraceId()
      : argument;

  if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(traceId)) {
    throw new Error(`Invalid trace id: ${traceId}`);
  }

  await access(tracePaths(traceId).manifest);
  return traceId;
}

function openBrowser(url: string): void {
  const command =
    process.platform === "darwin"
      ? "open"
      : process.platform === "win32"
        ? "cmd"
        : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", url] : [url];
  const child = spawn(command, args, {
    detached: true,
    stdio: "ignore",
  });
  child.unref();
}

try {
  const args = process.argv.slice(2);
  const traceArgument = args.find((argument) => !argument.startsWith("--"));
  const shouldOpen = !args.includes("--no-open");
  const traceId = await resolveTraceId(traceArgument);
  await replayTrace(traceId);
  const portValue = Number.parseInt(
    process.env.TRACE_INSPECTOR_PORT ?? "4318",
    10,
  );

  if (!Number.isInteger(portValue) || portValue < 1 || portValue > 65_535) {
    throw new Error("TRACE_INSPECTOR_PORT must be an integer from 1 to 65535.");
  }

  const server = await startTimelineServer(traceId, portValue);

  console.log(`Viewing ${traceId}`);
  console.log(server.url);
  console.log("Press Ctrl+C to stop.");

  if (shouldOpen) {
    openBrowser(server.url);
  }

  process.once("SIGINT", async () => {
    await server.close();
    process.exit(0);
  });
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
