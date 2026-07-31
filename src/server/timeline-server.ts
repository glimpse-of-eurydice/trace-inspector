import { createServer, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { readRawRecords, tracePaths } from "../store/trace-files.js";

export interface TimelineServer {
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

function parseJsonLines(text: string): unknown[] {
  return text
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as unknown);
}

async function readOptionalJson(file: string): Promise<unknown | null> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as unknown;
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? error.code
        : undefined;

    if (code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

export async function startTimelineServer(
  traceId: string,
  port = 4318,
): Promise<TimelineServer> {
  const paths = tracePaths(traceId);
  const projectRoot = process.cwd();
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

      if (url.pathname === "/api/trace") {
        const [
          manifestText,
          eventsText,
          spansText,
          findingsText,
          rawRecords,
          securityCase,
        ] = await Promise.all([
          readFile(paths.manifest, "utf8"),
          readFile(paths.events, "utf8"),
          readFile(paths.spans, "utf8"),
          readFile(paths.findings, "utf8"),
          readRawRecords(paths.raw),
          readOptionalJson(join(paths.directory, "security-case.json")),
        ]);

        sendJson(response, 200, {
          manifest: JSON.parse(manifestText) as unknown,
          events: parseJsonLines(eventsText),
          spans: parseJsonLines(spansText),
          findings: parseJsonLines(findingsText),
          rawRecords,
          securityCase,
        });
        return;
      }

      if (url.pathname === "/app.js") {
        await sendFile(
          response,
          resolve(projectRoot, "dist/web/app.js"),
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

      if (url.pathname === "/" || url.pathname === "/index.html") {
        await sendFile(
          response,
          resolve(projectRoot, "web/index.html"),
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
