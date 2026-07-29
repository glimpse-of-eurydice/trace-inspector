import type {
  CodexRuntimeMetadata,
} from "../core/codex-runtime-metadata.js";

export const MEMORY_CASE_MODEL = "gpt-5.6-sol";
export const MEMORY_CASE_REASONING_EFFORT = "medium";
export const MEMORY_CASE_APPROVAL_POLICY = "never";
export const MEMORY_CASE_SANDBOX_TYPE = "workspaceWrite";

export interface RuntimeAudit {
  passed: boolean;
  missingFields: string[];
  mismatches: string[];
}

export function auditMemoryCaseRuntime(
  runtime: CodexRuntimeMetadata,
  workspaceDirectory: string,
): RuntimeAudit {
  const missingFields: string[] = [];
  const mismatches: string[] = [];
  const required: Array<[string, string | null]> = [
    ["userAgent", runtime.userAgent],
    ["cliVersion", runtime.cliVersion],
    ["model", runtime.model],
    ["modelProvider", runtime.modelProvider],
    ["reasoningEffort", runtime.reasoningEffort],
    ["approvalPolicy", runtime.approvalPolicy],
  ];

  for (const [field, value] of required) {
    if (value === null || value.trim() === "") {
      missingFields.push(field);
    }
  }

  if (runtime.model !== MEMORY_CASE_MODEL) {
    mismatches.push(
      `model: expected ${MEMORY_CASE_MODEL}, observed ${String(runtime.model)}`,
    );
  }

  if (runtime.reasoningEffort !== MEMORY_CASE_REASONING_EFFORT) {
    mismatches.push(
      `reasoningEffort: expected ${MEMORY_CASE_REASONING_EFFORT}, observed ${String(runtime.reasoningEffort)}`,
    );
  }

  if (runtime.approvalPolicy !== MEMORY_CASE_APPROVAL_POLICY) {
    mismatches.push(
      `approvalPolicy: expected ${MEMORY_CASE_APPROVAL_POLICY}, observed ${String(runtime.approvalPolicy)}`,
    );
  }

  if (runtime.sandbox === null) {
    missingFields.push("sandbox");
  } else {
    if (runtime.sandbox.type !== MEMORY_CASE_SANDBOX_TYPE) {
      mismatches.push(
        `sandbox.type: expected ${MEMORY_CASE_SANDBOX_TYPE}, observed ${String(runtime.sandbox.type)}`,
      );
    }

    if (runtime.sandbox.networkAccess !== false) {
      mismatches.push(
        `sandbox.networkAccess: expected false, observed ${String(runtime.sandbox.networkAccess)}`,
      );
    }
  }

  if (!runtime.runtimeWorkspaceRoots.includes(workspaceDirectory)) {
    mismatches.push(
      "runtimeWorkspaceRoots did not contain the isolated workspace.",
    );
  }

  return {
    passed: missingFields.length === 0 && mismatches.length === 0,
    missingFields,
    mismatches,
  };
}
