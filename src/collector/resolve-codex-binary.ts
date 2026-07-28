import { constants } from "node:fs";
import { access, readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { delimiter, join } from "node:path";

async function isExecutable(path: string): Promise<boolean> {
  try {
    await access(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function executableName(): string {
  return process.platform === "win32" ? "codex.exe" : "codex";
}

function bundledPlatformDirectories(): string[] {
  if (process.platform === "darwin" && process.arch === "arm64") {
    return ["macos-aarch64", "darwin-arm64"];
  }

  if (process.platform === "darwin" && process.arch === "x64") {
    return ["macos-x86_64", "darwin-x64"];
  }

  if (process.platform === "linux" && process.arch === "arm64") {
    return ["linux-aarch64"];
  }

  if (process.platform === "linux" && process.arch === "x64") {
    return ["linux-x86_64"];
  }

  if (process.platform === "win32" && process.arch === "x64") {
    return ["windows-x86_64", "win32-x64"];
  }

  return [];
}

async function findOnPath(): Promise<string | undefined> {
  const pathDirectories = (process.env.PATH ?? "")
    .split(delimiter)
    .filter((directory) => directory.length > 0);

  for (const directory of pathDirectories) {
    const candidate = join(directory, executableName());

    if (await isExecutable(candidate)) {
      return candidate;
    }
  }

  return undefined;
}

async function findInExtensionRoot(
  extensionRoot: string,
): Promise<string | undefined> {
  let entries: string[];

  try {
    entries = await readdir(extensionRoot);
  } catch {
    return undefined;
  }

  const extensionDirectories = entries
    .filter((entry) => entry.startsWith("openai.chatgpt-"))
    .sort()
    .reverse();

  for (const extensionDirectory of extensionDirectories) {
    for (const platformDirectory of bundledPlatformDirectories()) {
      const candidate = join(
        extensionRoot,
        extensionDirectory,
        "bin",
        platformDirectory,
        executableName(),
      );

      if (await isExecutable(candidate)) {
        return candidate;
      }
    }
  }

  return undefined;
}

export async function resolveCodexBinary(): Promise<string> {
  const configuredBinary = process.env.CODEX_BIN;

  if (configuredBinary !== undefined) {
    if (await isExecutable(configuredBinary)) {
      return configuredBinary;
    }

    throw new Error(
      `CODEX_BIN points to a missing or non-executable file: ${configuredBinary}`,
    );
  }

  const pathBinary = await findOnPath();

  if (pathBinary !== undefined) {
    return pathBinary;
  }

  const userHome = homedir();
  const extensionRoots = [
    join(userHome, ".vscode", "extensions"),
    join(userHome, ".vscode-insiders", "extensions"),
    join(userHome, ".cursor", "extensions"),
  ];

  for (const extensionRoot of extensionRoots) {
    const extensionBinary = await findInExtensionRoot(extensionRoot);

    if (extensionBinary !== undefined) {
      return extensionBinary;
    }
  }

  throw new Error(
    [
      "Could not find the Codex CLI executable.",
      "Install Codex on PATH or run with CODEX_BIN=/absolute/path/to/codex.",
    ].join(" "),
  );
}
