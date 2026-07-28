import { spawn } from "node:child_process";
import { prepareComparisonDemo } from "../demo/prepare-comparison-demo.js";
import { startComparisonServer } from "../server/comparison-server.js";

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
  const shouldOpen = !process.argv.slice(2).includes("--no-open");
  const comparison = await prepareComparisonDemo();
  const portValue = Number.parseInt(
    process.env.TRACE_INSPECTOR_COMPARE_PORT ?? "4319",
    10,
  );

  if (!Number.isInteger(portValue) || portValue < 1 || portValue > 65_535) {
    throw new Error(
      "TRACE_INSPECTOR_COMPARE_PORT must be an integer from 1 to 65535.",
    );
  }

  const server = await startComparisonServer(comparison, portValue);
  const divergence = comparison.diff.firstObservableDivergence;

  console.log(`Comparing ${comparison.diff.leftTraceId}`);
  console.log(`     with ${comparison.diff.rightTraceId}`);

  if (comparison.diff.alignment.status === "ambiguous") {
    console.log(
      "Alignment is ambiguous under v2-default; first observable divergence was withheld.",
    );
  } else if (divergence === undefined) {
    console.log("No observable divergence under v2-default.");
  } else {
    console.log(
      `First observable divergence at alignment ${divergence.alignmentIndex}: ${divergence.reasons.map((reason) => reason.code).join(", ")}`,
    );
  }

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
