import { createServer, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { PreparedComparisonDemo } from "../demo/prepare-comparison-demo.js";
import { readRawRecords, tracePaths } from "../store/trace-files.js";

export interface ComparisonServer {
  url: string;
  close: () => Promise<void>;
}

function setSecurityHeaders(response: ServerResponse): void {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
  );
}

function sendJson(
  response: ServerResponse,
  statusCode: number,
  value: unknown,
): void {
  setSecurityHeaders(response);
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(`${JSON.stringify(value)}\n`);
}

async function sendFile(
  response: ServerResponse,
  file: string,
  contentType: string,
): Promise<void> {
  const content = await readFile(file);
  setSecurityHeaders(response);
  response.statusCode = 200;
  response.setHeader("Content-Type", contentType);
  response.end(content);
}

async function tracePayload(
  traceId: string,
  events: PreparedComparisonDemo["left"]["replay"]["events"],
): Promise<Record<string, unknown>> {
  const paths = tracePaths(traceId);
  const [manifestText, rawRecords] = await Promise.all([
    readFile(paths.manifest, "utf8"),
    readRawRecords(paths.raw),
  ]);

  return {
    manifest: JSON.parse(manifestText) as unknown,
    events,
    rawRecords,
  };
}

export async function startComparisonServer(
  comparison: PreparedComparisonDemo,
  port = 4319,
): Promise<ComparisonServer> {
  const projectRoot = process.cwd();
  const [left, right] = await Promise.all([
    tracePayload(comparison.left.traceId, comparison.left.replay.events),
    tracePayload(comparison.right.traceId, comparison.right.replay.events),
  ]);
  const payload = {
    comparisonId: comparison.comparisonId,
    intervention: comparison.intervention,
    diff: comparison.diff,
    left,
    right,
  };
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(
        request.url ?? "/",
        `http://${request.headers.host ?? "127.0.0.1"}`,
      );

      if (request.method !== "GET") {
        sendJson(response, 405, { error: "Method not allowed" });
        return;
      }

      if (url.pathname === "/api/comparison") {
        sendJson(response, 200, payload);
        return;
      }

      if (url.pathname === "/compare.js") {
        await sendFile(
          response,
          resolve(projectRoot, "dist/web/compare-app.js"),
          "text/javascript; charset=utf-8",
        );
        return;
      }

      if (url.pathname === "/styles.css") {
        await sendFile(
          response,
          resolve(projectRoot, "web/styles.css"),
          "text/css; charset=utf-8",
        );
        return;
      }

      if (url.pathname === "/" || url.pathname === "/compare.html") {
        await sendFile(
          response,
          resolve(projectRoot, "web/compare.html"),
          "text/html; charset=utf-8",
        );
        return;
      }

      sendJson(response, 404, { error: "Not found" });
    } catch (error) {
      sendJson(response, 500, {
        error: error instanceof Error ? error.message : "Unknown server error",
      });
    }
  });

  await new Promise<void>((resolveListening, rejectListening) => {
    const handleError = (error: Error) => rejectListening(error);
    server.once("error", handleError);
    server.listen(port, "127.0.0.1", () => {
      server.off("error", handleError);
      resolveListening();
    });
  });

  return {
    url: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise<void>((resolveClose, rejectClose) => {
        server.close((error) => {
          if (error === undefined) {
            resolveClose();
          } else {
            rejectClose(error);
          }
        });
      }),
  };
}
