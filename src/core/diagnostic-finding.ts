import type { EvidenceLevel } from "./trace-event.js";

export type DiagnosticRuleId =
  | "failed_operation"
  | "incomplete_operation"
  | "interrupted_operation";

export type DiagnosticSeverity = "warning" | "error";

export interface DiagnosticFinding {
  schemaVersion: "0.1";
  findingId: string;
  traceId: string;
  ruleId: DiagnosticRuleId;
  severity: DiagnosticSeverity;
  title: string;
  description: string;
  evidenceLevel: EvidenceLevel;
  evidenceEventIds: string[];
  evidenceSpanIds: string[];
  createdBy: {
    type: "deterministic_rule";
    version: "0.1.0";
  };
}
