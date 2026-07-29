export interface CodexSandboxMetadata {
  type: string | null;
  writableRoots: string[];
  networkAccess: boolean | null;
}

export interface CodexRuntimeMetadata {
  userAgent: string | null;
  cliVersion: string | null;
  platformFamily: string | null;
  platformOs: string | null;
  model: string | null;
  modelProvider: string | null;
  serviceTier: string | null;
  reasoningEffort: string | null;
  approvalPolicy: string | null;
  sandbox: CodexSandboxMetadata | null;
  runtimeWorkspaceRoots: string[];
  instructionSources: string[];
  multiAgentMode: string | null;
}

export function emptyCodexRuntimeMetadata(): CodexRuntimeMetadata {
  return {
    userAgent: null,
    cliVersion: null,
    platformFamily: null,
    platformOs: null,
    model: null,
    modelProvider: null,
    serviceTier: null,
    reasoningEffort: null,
    approvalPolicy: null,
    sandbox: null,
    runtimeWorkspaceRoots: [],
    instructionSources: [],
    multiAgentMode: null,
  };
}
