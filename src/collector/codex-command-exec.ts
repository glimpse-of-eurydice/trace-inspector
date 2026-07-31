import { spawn } from "node:child_process";
import { once } from "node:events";
import {
  access,
  mkdir,
  mkdtemp,
  rm,
} from "node:fs/promises";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { resolveCodexBinary } from "./resolve-codex-binary.js";

export interface SandboxCommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface WorkspaceWriteProbe {
  checkedAt: string;
  passed: boolean;
  workspaceWrite: SandboxCommandResult;
  deniedSiblingWrite: SandboxCommandResult;
  allowedAdditionalRootWrite: SandboxCommandResult;
  deniedArtifactAbsent: boolean;
  claimBoundary: string;
}

interface SandboxCommand {
  command: string[];
  cwd: string;
  writableRoots: string[];
}

function send(
  stdin: NodeJS.WritableStream,
  message: Record<string, unknown>,
): void {
  stdin.write(`${JSON.stringify(message)}\n`);
}

function commandResult(value: unknown): SandboxCommandResult {
  const envelope = value as {
    result?: { exitCode?: unknown; stdout?: unknown; stderr?: unknown };
    error?: { message?: unknown };
  };

  if (envelope.error !== undefined) {
    throw new Error(
      typeof envelope.error.message === "string"
        ? envelope.error.message
        : "Codex command/exec request failed.",
    );
  }

  const result = envelope.result;

  if (typeof result?.exitCode !== "number") {
    throw new Error("Codex command/exec response omitted exitCode.");
  }

  return {
    exitCode: result.exitCode,
    stdout: typeof result.stdout === "string" ? result.stdout : "",
    stderr: typeof result.stderr === "string" ? result.stderr : "",
  };
}

async function runSandboxCommands(
  commands: SandboxCommand[],
): Promise<SandboxCommandResult[]> {
  const codex = await resolveCodexBinary();
  const first = commands[0];

  if (first === undefined) {
    return [];
  }

  const child = spawn(codex, ["app-server", "--stdio"], {
    cwd: first.cwd,
    stdio: ["pipe", "pipe", "pipe"],
  });
  const closed = once(child, "close");
  const lines = createInterface({ input: child.stdout });
  const results: SandboxCommandResult[] = [];
  let stderr = "";
  let initialized = false;

  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk: string) => {
    stderr += chunk;
  });

  send(child.stdin, {
    method: "initialize",
    id: 0,
    params: {
      clientInfo: {
        name: "trace_inspector_preflight",
        title: "Trace Inspector Preflight",
        version: "0.1.0",
      },
      capabilities: null,
    },
  });

  try {
    for await (const line of lines) {
      const message = JSON.parse(line) as {
        id?: unknown;
        result?: unknown;
        error?: unknown;
      };

      if (message.id === 0 && message.result !== undefined && !initialized) {
        initialized = true;
        send(child.stdin, { method: "initialized", params: {} });
      } else if (typeof message.id === "number" && message.id > 0) {
        results.push(commandResult(message));
      } else {
        continue;
      }

      const next = commands[results.length];

      if (next === undefined) {
        break;
      }

      send(child.stdin, {
        method: "command/exec",
        id: results.length + 1,
        params: {
          command: next.command,
          cwd: next.cwd,
          sandboxPolicy: {
            type: "workspaceWrite",
            writableRoots: next.writableRoots,
            networkAccess: false,
          },
          timeoutMs: 10_000,
        },
      });
    }
  } finally {
    lines.close();

    if (child.exitCode === null && child.signalCode === null) {
      child.kill("SIGTERM");
    }

    await closed;
  }

  if (results.length !== commands.length) {
    throw new Error(
      `Sandbox probe received ${results.length}/${commands.length} results. ${stderr}`,
    );
  }

  return results;
}

async function isAbsent(path: string): Promise<boolean> {
  try {
    await access(path);
    return false;
  } catch {
    return true;
  }
}

export async function probeWorkspaceWriteBoundary(
  outputRoot: string,
): Promise<WorkspaceWriteProbe> {
  await mkdir(outputRoot, { recursive: true });
  const probeRoot = await mkdtemp(join(resolve(outputRoot), "sandbox-preflight-"));
  const workspace = join(probeRoot, "workspace");
  const quarantine = join(probeRoot, "quarantine");
  const deniedTarget = join(quarantine, "blocked.txt");

  await mkdir(workspace);
  await mkdir(quarantine);

  try {
    const [workspaceWrite, deniedSiblingWrite, allowedAdditionalRootWrite] =
      await runSandboxCommands([
        {
          command: ["/usr/bin/touch", join(workspace, "allowed.txt")],
          cwd: workspace,
          writableRoots: [workspace],
        },
        {
          command: ["/usr/bin/touch", deniedTarget],
          cwd: workspace,
          writableRoots: [workspace],
        },
        {
          command: [
            "/usr/bin/touch",
            join(quarantine, "allowed-extra-root.txt"),
          ],
          cwd: workspace,
          writableRoots: [workspace, quarantine],
        },
      ]);

    if (
      workspaceWrite === undefined ||
      deniedSiblingWrite === undefined ||
      allowedAdditionalRootWrite === undefined
    ) {
      throw new Error("Sandbox probe did not return all three results.");
    }

    const deniedArtifactAbsent = await isAbsent(deniedTarget);

    return {
      checkedAt: new Date().toISOString(),
      passed:
        workspaceWrite.exitCode === 0 &&
        deniedSiblingWrite.exitCode !== 0 &&
        deniedArtifactAbsent &&
        allowedAdditionalRootWrite.exitCode === 0,
      workspaceWrite,
      deniedSiblingWrite,
      allowedAdditionalRootWrite,
      deniedArtifactAbsent,
      claimBoundary:
        "This model-free probe demonstrates an effective filesystem capability boundary. It does not predict whether an agent will attempt the tested operation.",
    };
  } finally {
    await rm(probeRoot, { recursive: true, force: true });
  }
}
